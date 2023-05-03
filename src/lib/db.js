/** @param {NS} ns */
// Create arrayStore class
export class arrayStore {

    #w;
    #r;
    #file;

    // Setup new instance of class
    constructor(ns, file) {
        this.#w = ns.write;
        this.#r = ns.read;
        this.#file = file;
    }

    // Setup write function
    async write(data, mode = "w") {
        await this.#w(this.#file, JSON.stringify(data), mode);
    }

    // Setup read function
    async read() {
        let dataString = await this.#r(this.#file);
        if (dataString.length >= 1) {
            return JSON.parse(dataString);
        } else {
            return [];
        }
    }
}

// Create dictStore class
export class dictStore {

    #w;
    #r;
    #file;

    // Setup new instance of class
    constructor(ns, file) {
        this.#w = ns.write;
        this.#r = ns.read;
        this.#file = file;
    }

    // Setup write function
    async write(data, mode = "w") {
        await this.#w(this.#file, JSON.stringify(data), mode);
    }

    // Setup read function
    async read() {
        let dataString = await this.#r(this.#file);
        if (dataString.length > 1) {
            return JSON.parse(dataString);
        } else {
            return {};
        }
    }
}