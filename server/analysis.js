function sampleEntropy(data, m = 2, r = 0.2) {
    if (data.length < m+1) {
        return 0;
    }
    let B = 0, A = 0;
    for (let i = 0; i < data.length - m; i++) {
        const pattern1 = data.slice(i, i + m);
        const pattern2 = data.slice(i, i + m + 1);
        let countB = 0, countA = 0;
        for (let j = 0; j < data.length - m; j++) {
            if (j !== i) {
                const windowB = data.slice(j, j + m);
                const windowA = data.slice(j, j + m + 1);
                const distB = pattern1.map((val, idx) => Math.abs(val - windowB[idx]));
                const distA = pattern2.map((val, idx) => Math.abs(val - windowA[idx]));
                if (Math.max(...distB) < r) countB++;
                if (Math.max(...distA) < r) countA++;
            }
        }
        B += countB;
        A += countA;
    }
    B /= (data.length - m) * (data.length - m - 1);
    A /= (data.length - m) * (data.length - m - 1);
    return -Math.log(A / B);
}

// 平均値を計算する関数
function calculateMean(arr) {
    if (!arr || arr.length === 0) {
        return 0;
    }
    return arr.reduce((sum, value) => sum + value, 0) / arr.length;
}

//標準偏差関数
function StandardDeviation(arr) {
    const meanValue = calculateMean(arr);
    const variance = arr.reduce((sum, value) => sum + Math.pow(value - meanValue, 2), 0) / arr.length;
    const standardDeviation = Math.sqrt(variance);
    return standardDeviation;
}

// 中央値関数
function median(value) {
    value.sort(function(a, b) {
        return a - b;
    });
    const half = Math.floor(value.length / 2);
    if (value.length % 2) {
        return value[half];
    } else {
        return (value[half - 1] + value[half]) / 2.0;
    }
}

export { sampleEntropy, calculateMean, StandardDeviation };
