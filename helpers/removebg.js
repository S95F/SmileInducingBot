



const { createCanvas, loadImage } = require('canvas');

async function removeBackgroundFromImage(imageSource, options = {}) {
    const image = await loadImage(imageSource);
    const { width, height } = image;

    const {
        borderSampleSize = 1,
        colorThreshold = 10,
        outlierThreshold = 2,
    } = options;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const backgroundColor = sampleAndDetermineBackground(ctx, width, height, borderSampleSize, outlierThreshold);

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            if (x < borderSampleSize || y < borderSampleSize || x >= width - borderSampleSize || y >= height - borderSampleSize) {
                continue; // Skip border pixels
            }
            const pixelColor = ctx.getImageData(x, y, 1, 1).data;
            if (isBackground(pixelColor, backgroundColor, colorThreshold)) {
                ctx.clearRect(x, y, 1, 1);
            }
        }
    }

    return canvas;
}


function sampleAndDetermineBackground(ctx, width, height, sampleSize, outlierThreshold) {
    let pixels = [];
    
    // Sample border pixels
    [0, height - sampleSize].forEach(y => {
        for (let x = 0; x < width; x++) {
            pixels.push(ctx.getImageData(x, y, 1, 1).data);
        }
    });
    [0, width - sampleSize].forEach(x => {
        for (let y = 0; y < height; y++) {
            pixels.push(ctx.getImageData(x, y, 1, 1).data);
        }
    });

    // Filter out outliers
    pixels = filterOutliers(pixels, outlierThreshold);

    // Calculate the average color of the remaining pixels
    let avgColor = [0, 0, 0];
    pixels.forEach(pixel => {
        avgColor[0] += pixel[0];
        avgColor[1] += pixel[1];
        avgColor[2] += pixel[2];
    });
    avgColor = avgColor.map(c => Math.round(c / pixels.length));
    
    return avgColor; // Returns [R, G, B]
}



function isBackground(pixelColor, backgroundColor, threshold) {
    const colorDistance = Math.sqrt(
        Math.pow(pixelColor[0] - backgroundColor[0], 2) +
        Math.pow(pixelColor[1] - backgroundColor[1], 2) +
        Math.pow(pixelColor[2] - backgroundColor[2], 2)
    );
    return colorDistance < threshold;
}


function filterOutliers(pixels, threshold) {
    const means = [0, 0, 0];
    const stdDevs = [0, 0, 0];
    let filteredPixels = [];

    // Calculate means
    pixels.forEach(pixel => {
        means[0] += pixel[0];
        means[1] += pixel[1];
        means[2] += pixel[2];
    });
    means[0] /= pixels.length;
    means[1] /= pixels.length;
    means[2] /= pixels.length;

    // Calculate standard deviations
    pixels.forEach(pixel => {
        stdDevs[0] += Math.pow(pixel[0] - means[0], 2);
        stdDevs[1] += Math.pow(pixel[1] - means[1], 2);
        stdDevs[2] += Math.pow(pixel[2] - means[2], 2);
    });
    stdDevs[0] = Math.sqrt(stdDevs[0] / pixels.length);
    stdDevs[1] = Math.sqrt(stdDevs[1] / pixels.length);
    stdDevs[2] = Math.sqrt(stdDevs[2] / pixels.length);

    // Filter out outliers
    pixels.forEach(pixel => {
        if (Math.abs(pixel[0] - means[0]) <= threshold * stdDevs[0] &&
            Math.abs(pixel[1] - means[1]) <= threshold * stdDevs[1] &&
            Math.abs(pixel[2] - means[2]) <= threshold * stdDevs[2]) {
            filteredPixels.push(pixel);
        }
    });

    return filteredPixels;
}


module.exports = { removeBackgroundFromImage };
