const Jimp = require('jimp');
const path = require('path');
const puppeteer = require('puppeteer');
const jDBSCAN = require('./jDBSCAN');
const concaveman = require('concaveman');
const Debug = require('debug');
const _ = require('lodash');

const debug = Debug('auto-test:image-diff');

async function generateImages(){
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.taobao.com/', {waitUntil: 'networkidle2'});
  await page.screenshot({path: './src/images/1.png'});

  await page.evaluate(() => {
    document.querySelector('.logo-bd').style.display = 'none';
  });

  await page.screenshot({path: './src/images/2.png'});

  await browser.close();
}


async function runTask(){

  await generateImages();

  const imgA = path.join(__dirname, './images/1.png');
  const imgB = path.join(__dirname, './images/2.png');
  
  const img1 = await Jimp.read(imgA);
  const img2 = await Jimp.read(imgB);

  const width = img1.bitmap.width;
  const height = img1.bitmap.height;

  console.log('width, height: ', width, height);
  
  const diff = Jimp.diff(img1, img2);
  const diffImage = diff.image;
  const match = parseInt((1 - diff.percent) * 10000, 10) / 100;
  
  console.log(diff, diffImage, match);

  diffImage.writeAsync('./src/images/diff.png');

  if (diff.percent < 0.0005) {
    // images match
    // debug('images match', diff.percent);

    console.log('images match');

    return {
      isSame: true,
      match
    };
  } else {
    // debug('images not match', diff.percent);

    const diffPoint = [];

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        if (_.isEqual({
          r: 255,
          g: 0,
          b: 0,
          a: 255,
        }, Jimp.intToRGBA(diffImage.getPixelColor(j, i)))) {
          diffPoint.push({
            x: j,
            y: i
          });
        }
      }
    }

    console.log('diffPoint', diffPoint, Jimp.intToRGBA(diffImage.getPixelColor(100, 100)));

    // if (diffPoint.length > width * height / 3) {
    //   return {
    //     isSame: false,
    //     diffImage: (await img2.getBase64Async('image/jpeg')).replace('data:image/jpeg;base64,', ''),
    //     match
    //   };
    // }

    // console.time('dbscanner');
    const dbscanner = jDBSCAN().eps(1).minPts(2).distance('EUCLIDEAN').data(diffPoint)();
    const res = [];
    dbscanner.map((type, i) => {
      res[type] = res[type] || [];
      res[type].push([diffPoint[i].x, diffPoint[i].y]);
    });

    // console.timeEnd('dbscanner');

    res.forEach(group => {
      const drawPoints = concaveman(group);
      
      drawPoints.forEach((point) => {
        img2.setPixelColor(Jimp.rgbaToInt(255, 0, 0, 255), point[0], point[1]);
      });
    });

    console.log(res);

    img2.writeAsync('./src/images/diff2.png');

    return {
      isSame: false,
      diffImage: (await img2.getBase64Async('image/jpeg')).replace('data:image/jpeg;base64,', ''),
      match
    };
  }

}

runTask();

