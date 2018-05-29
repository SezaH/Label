import * as fs from 'fs-extra';

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

    await fs.outputFile(`./data2/${name}.jpg`, Buffer.from(image));
  } catch (error) {
    console.error(error);
  }
}
