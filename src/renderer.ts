if (Symbol.asyncIterator === undefined) ((Symbol as any).asyncIterator) = Symbol.for('asyncIterator');

import { remote } from 'electron';
import * as fs from 'fs-extra';
import * as $ from 'jquery';
import { join as pathJoin, parse as parsePath, ParsedPath } from 'path';
import { RecordService } from './record';
import { Util } from './utils';
// tslint:disable-next-line:no-var-requires
const jsontoxml = require('json2xml');

/**
 * Describes an image load from the disk.
 */
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

/**
 * Describes a single object in the image.
 * Uses the same format as the tfrecord so it will
 * be easy to convert.
 * The name and id should match what is found in the .pbtxt file
 * being used.
 */
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

const record = new RecordService();

const wrapper = document.getElementById('main') as HTMLDivElement;


/** The canvas the images are drawn to when displayed to the user */
const imageCanvas = document.getElementById('image') as HTMLCanvasElement;
const imageContext = imageCanvas.getContext('2d');

/** The canvas where the bounding boxes are drawn to after the object is labeled. */
const boxesCanvas = document.getElementById('boxes') as HTMLCanvasElement;
const boxesContext = boxesCanvas.getContext('2d');

/** The canvas used to draw the bounding boxes and guides as the user is creating a new label. */
const drawCanvas = document.getElementById('draw') as HTMLCanvasElement;
const drawContext = drawCanvas.getContext('2d');

/** The select input for choosing the active class */
const labelSelect = document.getElementById('label-select') as HTMLSelectElement;

/** Maps the class id to the class name */
const labels = new Map<number, string>();


let imageDirectory = '';

/** The colors used to differentiate between classes */
const colors = ['#e41a1c', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#377eb8', '#f781bf'];

/** Start the labeling process */
async function main() {
  if (imageDirectory === '') return;

  // For each image in the image directory, label it and move it the output location.
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

/**
 * Reads in each file from the given directory.
 * Skips over files that are not jpegs.
 * For every jpeg construct an IImage object and return it.
 */
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

/**
 * Waits for the user to label a new object.
 * Returns the labeled image object.
 */
async function labelImage(image: IImage) {
  return new Promise<ILabeledImage>(resolve => {

    // Clear the canvases
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

    // On mouse move draw the box and guides at the mouse locaiton
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

    // Right clicks cancel the placement
    drawCanvas.oncontextmenu = event => {
      event.preventDefault();
      isPlacing = false;
    };

    // Clicking places the corners of the box
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

    // Escape cancels the placement
    // Enter moves to the next image
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

/** Populates the list of labeled objects on the right of the image */
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

/**
 * Creates the annotation file contents.
 * TUses the pascal voc xml format.
 */
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

/**
 * Reads and parses the label map file.
 * Populates the label map
 */
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

  // Populate the list in the modal.
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

document.getElementById('start-label-btn').addEventListener('click', () => main());
document.getElementById('export-btn').addEventListener('click', () => record.main());
document.getElementById('capture-btn').addEventListener('click', () => window.open('./capture.html', 'Capture'));

/** Hotkeys for switching between classes. */
document.addEventListener('keydown', event => {
  if (event.key >= '1' && event.key <= '9') {
    const key = parseInt(event.key, 10);
    if (labels.get(key) !== undefined) labelSelect.value = event.key;
  }
});

function checkEnableStartLabelBtn() {
  $('#start-label-btn').prop('disabled', !(labels.size > 0 && imageDirectory !== ''));
}
