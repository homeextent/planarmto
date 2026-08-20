import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const tempDir = path.join(projectRoot, 'planar-mto');
const zipFile = path.resolve(projectRoot, '..', 'planar-mto.zip');

async function main() {
  try {
    // 1. Clean up old temp dir if exists
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // 2. Create temp folder
    fs.mkdirSync(tempDir);

    // 3. Copy dist/ and planar-mto.php
    console.log('Copying files...');
    const distSource = path.join(projectRoot, 'dist');
    const phpFileSource = path.join(projectRoot, 'planar-mto.php');

    if (!fs.existsSync(distSource)) {
      console.error('Error: dist/ folder not found. Please run "npm run build" first.');
      process.exit(1);
    }

    if (!fs.existsSync(phpFileSource)) {
      console.error('Error: planar-mto.php not found.');
      process.exit(1);
    }

    fs.cpSync(distSource, path.join(tempDir, 'dist'), { recursive: true });
    fs.copyFileSync(phpFileSource, path.join(tempDir, 'planar-mto.php'));

    // 4. Compress
    console.log('Compressing...');
    if (fs.existsSync(zipFile)) {
      fs.unlinkSync(zipFile);
    }

    const isWindows = process.platform === 'win32';
    if (isWindows) {
      // Use PowerShell to zip on Windows
      // We use absolute paths to avoid confusion
      execSync(`powershell -Command "Compress-Archive -Path '${tempDir}' -DestinationPath '${zipFile}'"`);
    } else {
      // Use zip command on Linux/macOS
      // We change to the project root to zip the relative folder
      execSync(`cd "${projectRoot}" && zip -r "${zipFile}" planar-mto`);
    }

    console.log(`Success! ZIP file created at: ${zipFile}`);

  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  } finally {
    // 5. Clean up
    if (fs.existsSync(tempDir)) {
      console.log('Cleaning up temporary folder...');
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

main();
