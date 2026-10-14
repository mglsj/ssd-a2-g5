import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Vite's dependency pre-bundling moves maplibre-gl, which breaks its default worker path.
// svelte-maplibre-gl/vite does the same thing, but the pre-bundler cannot load its
// `?worker&url` import on Windows, so the app sets the worker URL from its own source.
setWorkerUrl(workerUrl);
