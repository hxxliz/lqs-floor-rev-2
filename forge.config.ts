import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { VitePlugin } from '@electron-forge/plugin-vite';

const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: 'LQsCuttingFloor',
    icon: 'assets/icon',
    extraResource: ['./runtime'],
  },
  makers: [new MakerSquirrel({
    name: 'LQsCuttingFloor',
    setupExe: 'LQsCuttingFloorSetup.exe',
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
