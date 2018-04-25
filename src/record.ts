import { remote } from 'electron';
import * as fs from 'fs-extra';
import { join as pathJoin, parse as parsePath } from 'path';
import * as tfrecord from 'tfrecord';
import { isArray } from 'util';
import { parseString } from 'xml2js';
import { parseNumbers } from 'xml2js/lib/processors';
import { ILabeledImage } from './renderer';
import { Util } from './utils';

interface ILabeledImageData extends ILabeledImage {
  data: Uint8Array;
}

export class RecordService {

  public async main() {
    const dataDir = await Util.getDirectoryName();
    const trainWriter = await tfrecord.createWriter(pathJoin(dataDir, 'train.record'));
    const evalWriter = await tfrecord.createWriter(pathJoin(dataDir, 'eval.record'));
    let trainCount = 0;
    let evalCount = 0;

    for await (const labeledImage of this.labeledImageDataStream(dataDir)) {
      const example = await this.createExample(labeledImage);

      if (Math.random() * 100 < 80) {
        await trainWriter.writeExample(example);
        trainCount++;
      } else {
        await evalWriter.writeExample(example);
        evalCount++;
      }
    }

    await trainWriter.close();
    await evalWriter.close();
    console.log(`${trainCount + evalCount} images processed`);
    console.log(`${trainCount} training images`);
    console.log(`${evalCount} eval images`);
  }


  private async *labeledImageDataStream(directory: string): AsyncIterableIterator<ILabeledImageData> {
    const fileNames = await fs.readdir(pathJoin(directory, 'annotations'));
    for (const fileName of fileNames) {
      const xml = await fs.readFile(pathJoin(directory, 'annotations', fileName), 'utf8');

      const labeledImage = await new Promise<ILabeledImageData>((resolve, reject) => {
        parseString(xml, { explicitArray: false, valueProcessors: [parseNumbers] }, (err, object) => {
          if (err) reject(err);
          if (!isArray(object.annotation.objects)) object.annotation.objects = [object.annotation.objects];
          resolve(object.annotation as ILabeledImageData);
        });
      });

      labeledImage.data = new Uint8Array(await fs.readFile(pathJoin(directory, 'images', labeledImage.fileName)));
      yield labeledImage;
    }
  }

  private async createExample(image: ILabeledImageData) {
    const builder = tfrecord.createBuilder();
    builder.setInteger('image/height', image.size.height);
    builder.setInteger('image/width', image.size.width);
    builder.setBinary('image/filename', new Uint8Array(Buffer.from(image.fileName)));
    builder.setBinary('image/source_id', new Uint8Array(Buffer.from(image.fileName)));
    builder.setBinary('image/encoded', image.data);
    builder.setBinary('image/format', new Uint8Array(Buffer.from('jpeg')));
    builder.setFloats('image/object/bbox/xmin', image.objects.map(o => o.bndbox.xmin / image.size.width));
    builder.setFloats('image/object/bbox/xmax', image.objects.map(o => o.bndbox.xmax / image.size.width));
    builder.setFloats('image/object/bbox/ymin', image.objects.map(o => o.bndbox.ymin / image.size.height));
    builder.setFloats('image/object/bbox/ymax', image.objects.map(o => o.bndbox.ymax / image.size.height));
    builder.setBinaries('image/object/class/text', image.objects.map(o => new Uint8Array(Buffer.from(o.name))));
    builder.setIntegers('image/object/class/label', image.objects.map(o => o.id));
    return builder.releaseExample();
  }
}
