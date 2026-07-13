//Minimal Demo of running C++ in browser
//
//Main thread, that owns the worker threads

const PHASE_LABEL = {
    load: 'Loading toolchain',
    compile: 'Compiling',
    run: 'Running',
};



class CompilerClient {
    constructor({ onWrite, onPhase, onDone }) {
        this.onWrite = onWrite;
        this.onPhase = onPhase;
        this.onDone = onDone;
        this.worker = null;
        this.seq = 0;
        this.job = null;
    }

    spawn() {
        this.worker = new Worker('worker.js');
        this.worker.addEventListener('message', (e) => this.handle(e.data));
        this.worker.addEventListener('error', (e) => {
            this.finish({ ok: false, error: e.message || 'worker crashed' });
        });
    }

    run(source, stdin) {
        if (this.job) return;
        if (!this.worker) this.spawn();

        const id = ++this.seq;
        this.job = { id, phase: null, phaseStart: performance.now(), start: performance.now() };
        this.worker.postMessage({ id, kind: 'run', source, stdin });
    }

    handle(msg) {
        if (!this.job || msg.id !== this.job.id) return; // stale, from a killed run

        if (msg.kind === 'write') {
            this.onWrite(msg.text);
            return;
        }

        if (msg.kind === 'phase') {
            const now = performance.now();
            const previous = this.job.phase;
            const elapsed = now - this.job.phaseStart;
            this.job.phase = msg.phase;
            this.job.phaseStart = now;
            this.onPhase(msg.phase, previous, elapsed);
            return;
        }

        if (msg.kind === 'done') {
            const elapsed = performance.now() - this.job.phaseStart;
            this.onPhase(null, this.job.phase, elapsed); // close out the last phase
            this.finish(msg);
        }
    }

    // Hard stop. Everything the worker held -- the compiled clang/lld modules,
    // the in-memory filesystem -- dies with it, so the next run cold-starts.
    stop() {
        if (!this.worker || !this.job) return;
        this.worker.terminate();
        this.worker = null;
        this.finish({ ok: false, killed: true, error: 'Stopped. Toolchain will reload on the next run.' });
    }

    finish(result) {
        if (!this.job) return;
        const elapsed = performance.now() - this.job.start;
        this.job = null;
        this.onDone({ ...result, elapsed });
    }
}

/* ---------- output ------------------------------------------------------
 * We don't render color. Clang's own colors are off (worker.js drops
 * -fcolor-diagnostics), but binji's hostLog hardcodes a yellow "> " arrow in
 * shared.js, so a stripper is still needed for the leftovers.
 *
 * Matches any ESC [ ... <letter> sequence, not just the color ones (`m`), so
 * a program that clears the screen with \x1b[2J doesn't spray junk either.
 * ---------------------------------------------------------------------- */
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');


//document elements
const $ = (id) => document.getElementById(id);
const source = $('source');
const stdin = $('stdin');
const output = $('output');
const status = $('status');
const runBtn = $('run');
const stopBtn = $('stop');
 
const ms_to_s = (ms) => `${(ms / 1000).toFixed(2)}s`;
 
const scroll = () => { output.scrollTop = output.scrollHeight; };

function emitText(t){
    output.appendChild(document.createTextNode(stripAnsi(t)));
    scroll();
}

function emitBanner(text, className) {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      output.appendChild(span);
      scroll();
}

function setStatus(text, className=' '){
    status.textContent = text;
    status.className = className;
}

//instantiate a client, defining the outputs
const client = new CompilerClient({
    onWrite: emitText,
    onPhase: (phase, pervious, elapsed) => {
        if(previous) emit Banner(`   ${PHASE_LABEL[previous].toLowerCase()} finished in ${secs(elapsed)}\n`, 'phase-done');
        if(phase){
            emitBanner(`\n ${PHASE_LABLE[phase]}...\n`, 'phase');
            setStatus(`${PHASE_LABLE[phase]}...\n`, 'busy');
        }
    },
    onDone: (result) => {
        runBtn.disabled = false;
        stopBtn.disabled = true;

        if(result.ok) {
            emitBanner(`\n Done in ${ms_to_s(result.elapsed)} seconds\n`, 'phase-ok');
            setStatus(`Finished in ${ms_to_s(result.elapsed)} seconds`, 'ok');
        } else {
            emitBanner(`\n ${result.error}\n`, 'phase-bad');
            setStatus(result.killed ? 'Stopped' : 'Failed', 'bad');
        }
    },
});


function run(){
    output.replaceChildren();
    runBtn.disabled = true;
    stopBtn.disabled = false;
    client.run(source.value, stdin.value);
}

runBtn.addEventListener('click', run);
stopBtn.addEventListener('click', () => client.stop());

























