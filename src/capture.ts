import * as fs from 'fs-extra';
import { Observable, Subject, Subscription } from 'rxjs';

const video = document.getElementById('video') as HTMLVideoElement;
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia({
    video: {
      height: 1080,
      width: 1920,
    },
  }).then(stream => {
    video.src = window.URL.createObjectURL(stream);
    video.play();
  });
}

async function snapshot() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 1920;
  canvas.height = 1080;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const name = ('00000000' + Math.floor(Math.random() * 100000000).toString()).slice(-8);

  try {
    const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.95));
    const image = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve((e.target as any).result);
      reader.onerror = e => reject((e.target as any).error);
      reader.readAsArrayBuffer(blob);
    });

    await fs.outputFile(`./unlabeled/${name}.jpg`, Buffer.from(image));
  } catch (error) {
    console.error(error);
  }
}

const captureStopped = new Subject<void>();
let running = false;

const intervalSelect = document.getElementById('interval') as HTMLSelectElement;
const startStopBtn = document.getElementById('start-stop-btn') as HTMLButtonElement;

startStopBtn.addEventListener('click', () => {
  if (running) {
    captureStopped.next();
    startStopBtn.innerHTML = 'Start';
    intervalSelect.disabled = false;
    running = false;
  } else {
    const interval = parseInt((document.getElementById('interval') as HTMLSelectElement).value, 10);
    if (isNaN(interval)) return;

    Observable.interval(interval * 1000).takeUntil(captureStopped).subscribe(() => snapshot());
    startStopBtn.innerHTML = 'Stop';
    intervalSelect.disabled = true;
    running = true;
  }
});

document.addEventListener('keydown', event => {
  if (event.key === ' ') snapshot();
});
