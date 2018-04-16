if (Symbol.asyncIterator === undefined) ((Symbol as any).asyncIterator) = Symbol.for('asyncIterator');

import { remote } from 'electron';
import * as fs from 'fs-extra';
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
}

const record = new RecordService();

const wrapper = document.getElementById('main') as HTMLDivElement;

const imageCanvas = document.getElementById('image') as HTMLCanvasElement;
const imageContext = imageCanvas.getContext('2d');

const boxesCanvas = document.getElementById('boxes') as HTMLCanvasElement;
const boxesContext = boxesCanvas.getContext('2d');

const drawCanvas = document.getElementById('draw') as HTMLCanvasElement;
const drawContext = drawCanvas.getContext('2d');

async function main() {
  const unlabeledDir = await Util.getDirectory();

  for await (const image of imageStream(unlabeledDir)) {
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
    boxesCanvas.width = image.size.width;
    boxesCanvas.height = image.size.height;
    boxesContext.clearRect(0, 0, image.size.width, image.size.height);
    drawCanvas.width = image.size.width;
    drawCanvas.height = image.size.height;
    drawContext.clearRect(0, 0, image.size.width, image.size.height);

    let isPlacing = false;
    let startX = 0;
    let startY = 0;
    const labeledImage = { ...image, objects: [] } as ILabeledImage;

    drawCanvas.onmousemove = event => {
      const x = event.pageX - wrapper.offsetLeft + wrapper.scrollLeft;
      const y = event.pageY - wrapper.offsetTop + wrapper.scrollTop;

      drawContext.clearRect(0, 0, image.size.width, image.size.height);
      drawContext.beginPath();
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
        boxesContext.beginPath();
        boxesContext.strokeStyle = '#FF0000';
        boxesContext.strokeRect(startX, startY, endX - startX, endY - startY);

        const object: IObject = {
          name: '',
          bndbox: {
            xmax: 0,
            xmin: 0,
            ymax: 0,
            ymin: 0,
          },
        };

        object.bndbox.xmax = Math.max(startX, endX);
        object.bndbox.xmin = Math.min(startX, endX);
        object.bndbox.ymax = Math.max(startY, endY);
        object.bndbox.ymin = Math.min(startY, endY);
        object.name = 'cup';

        labeledImage.objects.push(object);
        updateObjectList(labeledImage.objects);
      } else {
        isPlacing = true;
        startX = event.pageX - wrapper.offsetLeft + wrapper.scrollLeft;
        startY = event.pageY - wrapper.offsetTop + wrapper.scrollTop;
      }
    };

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
  for (const object of objects) {
    const li = document.createElement('li');
    li.innerText = object.name;
    li.classList.add('list-group-item');
    objectList.appendChild<HTMLLIElement>(li);
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

document.getElementById('label-btn').addEventListener('click', () => main());
document.getElementById('export-btn').addEventListener('click', () => record.main());
