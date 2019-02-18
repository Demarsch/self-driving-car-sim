const EPSILON = 10e-4;

class TrainingData {

    constructor() {
        this.data = [];
        this.labels = [];
        this._hashset = new Map();
        this.length = 0;
    }

    add(dataItem, label) {
        const hash = Math.round(dataItem.reduce((x, y) => x + y, 0) * 10e8);
        let bucket = this._hashset.get(hash);
        let result = false;
        if (bucket) {
            let found = true;
            for (var i = 0; i < bucket.length; i++) {
                found = true;
                let bucketItem = bucket[i];
                for (var j = 0; j < dataItem.length; j++) {
                    if (Math.abs(dataItem[j] - bucketItem[j]) > EPSILON) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    break;
                }
            }
            if (!found) {
                bucket.push(dataItem);
                result = true;
            } 
        } else {
            bucket = [dataItem];
            this._hashset.set(hash, bucket);
            result = true;
        }
        if (result) {        
            this.data.push(dataItem)
            this.labels.push(label);
        }
        if (result) {
            this.length = this.data.length;
        }
        return result;
    }    

    clear() {
        this.data.length = 0;
        this.labels.length = 0;
        this._hashset.clear();
        this.length = 0;
    }

    toJson() {
        return JSON.stringify({
            data: this.data,
            labels: this.labels
        });
    }

    fromJson(json) {
        if (json.data 
            && Array.isArray(json.data)
            && json.labels 
            && Array.isArray(json.labels)) {
                this.clear();
                for (var i = 0; i < json.data.length; i++) {
                    this.add(json.data[i], json.labels[i]);
                }
            }
    }
}