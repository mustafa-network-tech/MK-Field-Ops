import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/'))
                        return 'vendor-react';
                    if (id.includes('node_modules/react-router'))
                        return 'vendor-router';
                    if (id.includes('node_modules/@supabase'))
                        return 'vendor-supabase';
                },
            },
        },
        chunkSizeWarningLimit: 800,
    },
    server: { port: 5173 },
});
