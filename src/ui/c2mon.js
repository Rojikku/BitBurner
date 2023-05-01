/** @param {NS} ns **/
// Load Libraries
import { createSidebarItem, sidebar } from "/box/box.js"
import { arrayStore, dictStore } from "/lib/db.js";

export async function main(ns) {

    // Load list of hacked servers
    let hackedHandle = new arrayStore(ns, "/data/hacked.txt");
    // File that lists the next target of hacking
    let targetHandle = new arrayStore(ns, "/data/target.txt");

    let style = `<style>
    .f.mon {
        display:flex;
        flex-direction: column;
        flex-basis: auto;
        height: 10em;
        padding: 10px;
    }
    .f.mon>span {
        color:lightgrey;
        font-size: 1.6em;
        padding: 0px;
        margin: 0px;
    }
    </style>`
    let item = createSidebarItem("C2 Monitor", `
    ${style}
    <div class="f mon" id="c2mon">
    </div>`, "&#xEEBF");
    async function reload() {
        if (!sidebar.contains(item)) return clearInterval(interval);
        let target = await targetHandle.read();
        let hacked = await hackedHandle.read();
        item.querySelector('#c2mon').innerHTML = `
        <span style="color:lime;">Target: ${target}</span><br />
        <span>Servers Hacked: ${hacked.length}</span>
        `;
    }
    reload();
    let interval = setInterval(reload, 1000);
    let showNumbers = false;
    item.addContextItem("Toggle Numbers", () => {
        showNumbers = !showNumbers;
    });
}