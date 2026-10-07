#!/usr/bin/env bash
# One command from Praise's Mac: a box for Mama in AWS, the keys carried over SSH (never through git), the API and the
# ChatGPT app up behind Caddy. Idempotent: every step checks before it creates, so rerunning is safe.
#
#   bash deploy/aws-launch.sh           first time: key pair, security group, elastic IP, instance, then deploy
#   bash deploy/aws-launch.sh deploy    later: rsync the working tree to the box and redeploy
#
# Needs: the AWS CLI signed in (aws sts get-caller-identity), api/.env filled in locally. Prints the fixed IP at the
# end: two A records at Namecheap (api and chatgpt on mamabudget.com) point at it, and Caddy issues the certificates.
set -euo pipefail
cd "$(dirname "$0")/.."

REGION=${MAMA_AWS_REGION:-us-east-2}
NAME=mama-prod
KEY=mama-production
TYPE=${MAMA_AWS_TYPE:-t4g.small}          # arm64; the image is multi-arch and was proven on Apple silicon
DOMAIN=${MAMA_DOMAIN:-api.mamabudget.com}
CHAT_DOMAIN=${MAMA_CHATGPT_DOMAIN:-chatgpt.mamabudget.com}
KEYFILE="$HOME/.ssh/$KEY"
aws() { command aws --region "$REGION" "$@"; }
say() { printf '\n== %s\n' "$*"; }

if [ "${1:-}" != "deploy" ]; then
  say "key pair $KEY"
  if [ ! -f "$KEYFILE" ]; then
    if aws ec2 describe-key-pairs --key-names "$KEY" >/dev/null 2>&1; then
      echo "AWS already has a key pair named $KEY but $KEYFILE is not on this Mac. Delete it in AWS or restore the file."; exit 1
    fi
    aws ec2 create-key-pair --key-name "$KEY" --key-type ed25519 --query KeyMaterial --output text > "$KEYFILE"
    chmod 600 "$KEYFILE"
    echo "saved $KEYFILE"
  else
    echo "have $KEYFILE"
  fi

  say "security group $NAME (22, 80, 443)"
  VPC=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
  SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=$NAME Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)
  if [ -z "$SG" ] || [ "$SG" = "None" ]; then
    SG=$(aws ec2 create-security-group --group-name $NAME --description "Mama Budget API and ChatGPT app behind Caddy" --vpc-id "$VPC" --query GroupId --output text)
    aws ec2 authorize-security-group-ingress --group-id "$SG" --ip-permissions \
      'IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=0.0.0.0/0,Description=ssh}]' \
      'IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0,Description=acme and redirect}]' \
      'IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0,Description=https}]' >/dev/null
    aws ec2 create-tags --resources "$SG" --tags Key=Name,Value=$NAME Key=Project,Value=mama-budget
    echo "created $SG"
  else
    echo "have $SG"
  fi

  say "instance $NAME ($TYPE, Ubuntu 24.04 arm64, 20 GB)"
  ID=$(aws ec2 describe-instances --filters Name=tag:Name,Values=$NAME Name=instance-state-name,Values=pending,running,stopped --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || true)
  if [ -z "$ID" ] || [ "$ID" = "None" ]; then
    AMI=$(aws ssm get-parameter --name /aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id --query Parameter.Value --output text)
    ID=$(aws ec2 run-instances --image-id "$AMI" --instance-type "$TYPE" --key-name "$KEY" --security-group-ids "$SG" \
      --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20,VolumeType=gp3,DeleteOnTermination=true}' \
      --metadata-options HttpTokens=required \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME},{Key=Project,Value=mama-budget}]" "ResourceType=volume,Tags=[{Key=Name,Value=$NAME}]" \
      --query 'Instances[0].InstanceId' --output text)
    echo "launched $ID"
  else
    echo "have $ID"
    [ "$(aws ec2 describe-instances --instance-ids "$ID" --query 'Reservations[0].Instances[0].State.Name' --output text)" = "stopped" ] && aws ec2 start-instances --instance-ids "$ID" >/dev/null
  fi
  aws ec2 wait instance-running --instance-ids "$ID"

  say "elastic IP"
  ALLOC=$(aws ec2 describe-addresses --filters Name=tag:Name,Values=$NAME --query 'Addresses[0].AllocationId' --output text 2>/dev/null || true)
  if [ -z "$ALLOC" ] || [ "$ALLOC" = "None" ]; then
    ALLOC=$(aws ec2 allocate-address --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$NAME},{Key=Project,Value=mama-budget}]" --query AllocationId --output text)
    echo "allocated $ALLOC"
  fi
  ASSOC=$(aws ec2 describe-addresses --allocation-ids "$ALLOC" --query 'Addresses[0].InstanceId' --output text)
  [ "$ASSOC" = "$ID" ] || aws ec2 associate-address --allocation-id "$ALLOC" --instance-id "$ID" >/dev/null
fi

IP=$(aws ec2 describe-addresses --filters Name=tag:Name,Values=$NAME --query 'Addresses[0].PublicIp' --output text)
[ -n "$IP" ] && [ "$IP" != "None" ] || { echo "no elastic IP tagged $NAME; run without 'deploy' first"; exit 1; }
SSH="ssh -i $KEYFILE -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 ubuntu@$IP"

if ! grep -q "^Host $NAME\$" "$HOME/.ssh/config" 2>/dev/null; then
  printf '\nHost %s\n    HostName %s\n    User ubuntu\n    IdentityFile %s\n    IdentitiesOnly yes\n' "$NAME" "$IP" "$KEYFILE" >> "$HOME/.ssh/config"
  echo "ssh $NAME now works from this Mac"
fi

say "waiting for ssh on $IP"
for i in $(seq 1 36); do $SSH true 2>/dev/null && break; sleep 5; [ "$i" = 36 ] && { echo "the box never answered on 22"; exit 1; }; done
echo "up"

say "deploy/.env"
if [ ! -f deploy/.env ]; then
  [ -f api/.env ] || { echo "api/.env is missing; nothing to carry over"; exit 1; }
  # The API's own env, plus the box-only keys. Texts start dry on the box: flip PHOTON_DRY to 0 on the box when the
  # Photon line is confirmed. The server key encrypts bank links at rest; losing it means everyone relinks.
  { grep -vE '^(PORT|PHOTON_DRY|MAMA_DOMAIN|MAMA_CHATGPT_DOMAIN|MAMA_PUBLIC_URL|MAMA_SERVER_KEY)=' api/.env
    echo "PHOTON_DRY=1"
    echo "MAMA_DOMAIN=$DOMAIN"
    echo "MAMA_CHATGPT_DOMAIN=$CHAT_DOMAIN"
    echo "MAMA_PUBLIC_URL=https://$DOMAIN"
    echo "MAMA_SERVER_KEY=$(openssl rand -hex 32)"
  } > deploy/.env
  chmod 600 deploy/.env
  echo "written from api/.env (PHOTON_DRY=1 until the line is confirmed)"
else
  echo "have deploy/.env"
fi

say "copying the tree to the box"
rsync -az --delete -e "ssh -i $KEYFILE -o IdentitiesOnly=yes" \
  --exclude node_modules --exclude .git --exclude data --exclude 'api/.env' --exclude 'api/.cache' \
  --exclude '.output' --exclude '.wxt' --exclude 'apps/extension/.output' --exclude '*.zip' --exclude '.DS_Store' \
  ./ "ubuntu@$IP:~/mama-budget/"

say "deploying"
$SSH 'cd ~/mama-budget && bash deploy/deploy.sh'

say "done"
echo "box: $IP   (ssh $NAME)"
echo "DNS at Namecheap, two A records on mamabudget.com:"
echo "  api      -> $IP"
echo "  chatgpt  -> $IP"
echo "Then: https://$DOMAIN/health and https://$CHAT_DOMAIN/health answer once Caddy has the certificates (a minute after DNS)."
