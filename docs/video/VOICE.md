# Dropping her real voice into the 30 second video

The cut has her lines as captions and the six cues as audio. Her voice (Amarachi, ElevenLabs) goes on top. Generate the five lines below as mp3 with the same settings as the product (speed 0.94, stability 0.6, style 0.25), then mux at these times.

| Start | File | Line |
|---|---|---|
| 0.8 | v1.mp3 | So. I live in your cart now. That little face in the corner, that's me. |
| 3.6 | v2.mp3 | You give me one number for the week and I hold you to it. What you need, I don't touch. |
| 7.2 | v3.mp3 | Give me a second. Don't talk, I'm counting. |
| 11.3 | v4.mp3 | Last 30 days: one hundred and two dollars on food delivery. Rice was twenty four. We need to talk. |
| 15.8 | v5.mp3 | You spent one hundred and two on food delivery, so when DoorDash is open I'll say something. |
| 24.7 | v6.mp3 | You came for rice. How did AirPods enter the cart? |

One command, from this folder, with the six mp3s next to the mp4:

```
ffmpeg -y -i mama_budget_30s.mp4 -i v1.mp3 -i v2.mp3 -i v3.mp3 -i v4.mp3 -i v5.mp3 -i v6.mp3 \
 -filter_complex "[1]adelay=800|800[a1];[2]adelay=3600|3600[a2];[3]adelay=7200|7200[a3];[4]adelay=11300|11300[a4];[5]adelay=15800|15800[a5];[6]adelay=24700|24700[a6];[0:a][a1][a2][a3][a4][a5][a6]amix=inputs=7:normalize=0[a]" \
 -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k mama_budget_30s_voice.mp4
```

If a line runs longer than its slot, trim the mp3, do not move the video. Post the voice version. Caption for the post:

Every money app tells you after. We built your mother. She lives in your cart and says something before you pay. mamabudget.com. Built in 24 hours at MHacks.
