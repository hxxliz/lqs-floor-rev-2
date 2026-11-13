import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { VitePlugin } from '@electron-forge/plugin-vite';

const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: 'Vapormint',
    icon: 'assets/icon.ico',
    extraResource: ['./runtime', './scripts', './assets'],
  },
  makers: [new MakerSquirrel({
    name: 'Vapormint',
    setupExe: 'VapormintSetup.exe',
    setupIcon: 'assets/icon.ico',
    ...(certificateFile && certificatePassword ? { certificateFile, certificatePassword } : {}),
  })],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main.ts', config: 'vite.main.config.mts' },
        { entry: 'src/preload.ts', config: 'vite.preload.config.mts' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.mts' }],
    }),
  ],
};

export default config;
