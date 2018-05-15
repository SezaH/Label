if (Symbol.asyncIterator === undefined) ((Symbol as any).asyncIterator) = Symbol.for('asyncIterator');

import { remote } from 'electron';
import * as fs from 'fs-extra';
import * as $ from 'jquery';
import { join as pathJoin, parse as parsePath, ParsedPath } from 'path';
import { RecordService } from './record';
import { Util } from './utils';
// tslint:disable-next-line:no-var-requires
const jsontoxml = require('json2xml');

interface IImage {
  bitmap: ImageBitmap;
  filePath: string;
  fileName: string;
  size: {
    height: number;
    width: number;
    depth: number;
  };
}

export interface ILabeledImage extends IImage {
  objects: IObject[];
}

interface IObject {
  bndbox: {
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
  };
  name: string;
  id: number;
}

interface ILabel {
  id: number;
  name: string;
}

const record = new RecordService();

const wrapper = document.getElementById('main') as HTMLDivElement;

const imageCanvas = document.getElementById('image') as HTMLCanvasElement;
const imageContext = imageCanvas.getContext('2d');

const boxesCanvas = document.getElementById('boxes') as HTMLCanvasElement;
const boxesContext = boxesCanvas.getContext('2d');

const drawCanvas = document.getElementById('draw') as HTMLCanvasElement;
const drawContext = drawCanvas.getContext('2d');

const labelSelect = document.getElementById('label-select') as HTMLSelectElement;
const labels = new Map<number, string>();
let imageDirectory = '';

const colors = ['#e41a1c', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#377eb8', '#f781bf'];

async function main() {
  if (imageDirectory === '') return;
  for await (const image of imageStream(imageDirectory)) {
    updateObjectList([]);
    const labeledImage = await labelImage(image);
    const annotation = await createAnnotation(labeledImage);

    await fs.outputFile(`./data/annotations/${image.fileName}.xml`, annotation);
    await fs.move(image.filePath, `./data/images/${image.fileName}.jpg`);
  }

  boxesContext.clearRect(0, 0, boxesCanvas.width, boxesCanvas.height);
  drawContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  imageContext.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
}

async function* imageStream(directory: string): AsyncIterableIterator<IImage> {
  const fileNames = await fs.readdir(directory);
  for (const fileName of fileNames) {
    const parsedPath = parsePath(fileName);
    const extension = parsedPath.ext.toLowerCase();

    if (extension !== '.jpg' && extension !== '.jpeg') continue;
    const filePath = pathJoin(directory, fileName);
    const data = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);
    const bitmap = await createImageBitmap(new Blob([data]));
    const name = ('00000000' + (Math.floor(stats.atimeMs * stats.size) % 100000000).toString()).slice(-8);
    yield { fileName: name, filePath, bitmap, size: { height: bitmap.height, width: bitmap.width, depth: 3 } };
  }
}

async function labelImage(image: IImage) {
  return new Promise<ILabeledImage>(resolve => {
    imageCanvas.width = image.size.width;
    imageCanvas.height = image.size.height;
    imageContext.drawImage(image.bitmap, 0, 0);
    drawCanvas.width = image.size.width;
    drawCanvas.height = image.size.height;
    drawContext.clearRect(0, 0, image.size.width, image.size.height);
    boxesCanvas.width = image.size.width;
    boxesCanvas.height = image.size.height;

    let isPlacing = false;
    let startX = 0;
    let startY = 0;
    const labeledImage = { ...image, objects: [] } as ILabeledImage;

    drawCanvas.onmousemove = event => {
      const x = event.pageX - wrapper.offsetLeft + wrapper.scrollLeft;
      const y = event.pageY - wrapper.offsetTop + wrapper.scrollTop;

      drawContext.clearRect(0, 0, image.size.width, image.size.height);
      drawContext.beginPath();
      drawContext.strokeStyle = '#fdab1c';
      if (isPlacing) drawContext.strokeRect(startX, startY, x - startX, y - startY);
      drawContext.strokeRect(x, 0, 0, image.size.height);
      drawContext.strokeRect(0, y, image.size.width, 0);
    };

    drawCanvas.oncontextmenu = event => {
      event.preventDefault();
      isPlacing = false;
    };

    drawCanvas.onclick = event => {
      if (isPlacing) {
        isPlacing = false;
        drawContext.clearRect(0, 0, image.size.width, image.size.height);
        const endX = event.pageX - wrapper.offsetLeft + wrapper.scrollLeft;
        const endY = event.pageY - wrapper.offsetTop + wrapper.scrollTop;

        const object: IObject = {
          bndbox: {
            xmax: 0,
            xmin: 0,
            ymax: 0,
            ymin: 0,
          },
          id: 0,
          name: '',
        };

        object.bndbox.xmax = Math.max(startX, endX);
        object.bndbox.xmin = Math.min(startX, endX);
        object.bndbox.ymax = Math.max(startY, endY);
        object.bndbox.ymin = Math.min(startY, endY);
        object.name = labels.get(parseInt(labelSelect.value, 10));
        object.id = parseInt(labelSelect.value, 10);

        labeledImage.objects.push(object);
        updateObjectList(labeledImage.objects);
      } else {
        isPlacing = true;
        startX = event.pageX - wrapper.offsetLeft + wrapper.scrollLeft;
        startY = event.pageY - wrapper.offsetTop + wrapper.scrollTop;
      }
    };

    document.getElementById('clear-labels-btn').addEventListener('click', () => {
      labeledImage.objects.length = 0;
      updateObjectList(labeledImage.objects);
      boxesContext.clearRect(0, 0, image.size.width, image.size.height);
    });

    document.onkeypress = event => {
      console.log(event.key);
      switch (event.key) {
        case `Escape`:
          isPlacing = false;
          break;
        case 'Enter':
          document.onkeypress = undefined;
          drawCanvas.onmousemove = undefined;
          drawCanvas.onclick = undefined;
          resolve(labeledImage);
          break;
      }
    };
  });
}

const objectList = document.getElementById('object-list') as HTMLUListElement;
function updateObjectList(objects: IObject[]) {
  objectList.innerHTML = '';
  boxesContext.clearRect(0, 0, boxesCanvas.width, boxesCanvas.height);

  for (const [i, object] of objects.entries()) {
    const btn = document.createElement('button');
    const color = colors[(object.id - 1) % colors.length];

    btn.innerHTML = '&times;';
    btn.classList.add('close');
    btn.addEventListener('click', () => {
      objects.splice(i, 1);
      updateObjectList(objects);
    });

    const li = document.createElement('li');
    li.innerText = object.name;
    li.style.backgroundColor = Util.hexToRGB(color, 0.3);
    li.classList.add('list-group-item');
    li.appendChild(btn);

    objectList.appendChild(li);

    boxesContext.beginPath();
    boxesContext.strokeStyle = color;
    boxesContext.lineWidth = 2;
    boxesContext.strokeRect(object.bndbox.xmin, object.bndbox.ymin,
      object.bndbox.xmax - object.bndbox.xmin, object.bndbox.ymax - object.bndbox.ymin);
  }
}

function createAnnotation(image: ILabeledImage) {
  let annonation = '<annotation>';
  annonation += `<fileName>${image.fileName}.jpg</fileName>`;
  annonation += jsontoxml({ size: image.size });
  for (const objects of image.objects) {
    annonation += jsontoxml({ objects });
  }
  annonation += '</annotation>';
  return annonation;
}

document.getElementById('label-map-browse-btn').addEventListener('click', async () => {
  const labelMapFileName = await Util.getFileName({ name: 'Label Map', extensions: ['pbtxt'] });
  const labelMap = await fs.readFile(labelMapFileName, 'utf8');

  let match: RegExpExecArray;
  const labelRegex = /\bitem\s?{\s*id:\s?(\d+)\s*name:\s?'(\w+)'\s*}/gm;
  labels.clear();
  // tslint:disable-next-line:no-conditional-assignment
  while ((match = labelRegex.exec(labelMap)) !== null) {
    labels.set(parseInt(match[1], 10), match[2]);
  }

  const labelList = document.getElementById('label-map-list') as HTMLUListElement;
  const labelFileNameInput = document.getElementById('label-map-filename') as HTMLInputElement;

  labelFileNameInput.value = labelMapFileName;

  labelList.innerHTML = '';
  labelSelect.innerHTML = '';

  for (const [id, name] of labels) {
    const li = document.createElement('li');
    li.innerHTML = `${id}: ${name}`;
    li.classList.add('list-group-item');
    labelList.appendChild(li);

    const option = document.createElement('option');
    option.innerHTML = `${id}: ${name}`;
    option.value = id.toString();
    labelSelect.appendChild(option);
  }
  checkEnableStartLabelBtn();
});

document.getElementById('image-directory-browse-btn').addEventListener('click', async () => {
  imageDirectory = await Util.getDirectoryName();
  $('#image-directory').val(imageDirectory);
  checkEnableStartLabelBtn();
});

document.getElementById('start-label-btn').addEventListener('click', () => snapshot());
document.getElementById('export-btn').addEventListener('click', () => snapshot());

document.addEventListener('keydown', event => {
  if (event.key >= '1' && event.key <= '9') {
    const key = parseInt(event.key, 10);
    if (labels.get(key) !== undefined) labelSelect.value = event.key;
  } else if (event.key === 'q') {
    snapshot();
  }
});

function checkEnableStartLabelBtn() {
  $('#start-label-btn').prop('disabled', !(labels.size > 0 && imageDirectory !== ''));
}

const video = document.getElementById('video') as HTMLVideoElement;
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
    video.src = window.URL.createObjectURL(stream);
    video.play();
  });
}

async function snapshot() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = video.width;
  canvas.height = video.height;

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
