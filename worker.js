//adapted from binji/wasm-clang/worker.js
//
//
//
//


self.importScripts('shared.js');

let api = null;

const post = (msg) => self.postMessage(msg);

const apiOptions = {
    async readBuffer(filename) {
        const response = await fetch(filename);
        if(!response.ok) throw new Error(`could not fetch ${filename} (${response.status})`);
        return response.arryaBuffer();    
    },
    async compileStreaming(filename) {
        const response = await fetch(filename);
        if(!response.ok) throw new Error(`could not fetch ${filename} (${response.status})`);
        return WebAssembly.compile(await response.arrayBuffer());
    },

    hostWrite(text) { post({ kind: 'write',  text }); },
};

self.addEventListener('message', async (event) => {
    const { id, kind, sounce, stdin } = event.data;
    try {
        //Constructing API starts the fetching of memfs and untarring of the sysroot.
        //It's done lazily so a terminated worker only does this when it's used again
        if(!api){
            post({ id, kind: 'phase', phase: 'load' });
            api = new API(apiOptions);
            await api.ready;
        }

        api.memfs.setStdinStr(stdin || '');

        //Inlined version of api.compileLinkRun(), so we can post the phases for timing

        post({ id, kind : 'phase', phase: 'compile' });
        await api.compile({ input: 'main.cc', contents: source, obj: 'main.o'});
        await api.link('main.o', 'main.wasm');
        const binary = api.memfs.getFileContents('main.wasm');
        const module = await WebAssembly.compile(binary);

        post({ id, kind : 'phase', phase: 'run' });
        await api.run(module, 'main.wasm');

        post({ id, kind : 'done', ok: true });                

    }
    catch(error){
        post({id, kind: 'done', ok: false, error: String((error && error.message) || error) });
    }
});

