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

export { sampleEntropy };
