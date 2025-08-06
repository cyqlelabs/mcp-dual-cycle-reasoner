#!/usr/bin/env node

import { pipeline } from '@huggingface/transformers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CACHE_DIR = process.env.HF_HUB_CACHE || path.join(__dirname, '..', '.hf_cache');

async function downloadModels() {
  console.log('🤖 Pre-downloading Hugging Face models...');
  console.log(`📁 Cache directory: ${CACHE_DIR}`);

  // Ensure cache directory exists
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log(`✅ Created cache directory: ${CACHE_DIR}`);
  }

  const models = [
    {
      name: 'Xenova/all-MiniLM-L6-v2',
      task: 'feature-extraction',
      description: 'Sentence embedding model',
    },
    {
      name: 'MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33',
      task: 'zero-shot-classification',
      description: 'Zero-shot classification model',
    },
  ];

  for (const model of models) {
    try {
      console.log(`\n⬇️  Downloading ${model.description}: ${model.name}`);

      const startTime = Date.now();
      const pipe = await pipeline(model.task, model.name, {
        cache_dir: CACHE_DIR,
        progress_callback: (progress) => {
          if (progress.status === 'downloading') {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            process.stdout.write(`\r   Progress: ${percent}% (${progress.file})`);
          }
        },
      });

      // Test the model with a simple input
      if (model.task === 'feature-extraction') {
        await pipe('test input');
      } else if (model.task === 'zero-shot-classification') {
        await pipe('test input', ['positive', 'negative']);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n   ✅ Downloaded and verified in ${duration}s`);
    } catch (error) {
      console.error(`\n   ❌ Failed to download ${model.name}:`, error.message);

      // Try to clean up any partial downloads
      try {
        const modelPath = path.join(CACHE_DIR, 'Xenova', model.name.split('/')[1]);
        if (fs.existsSync(modelPath)) {
          fs.rmSync(modelPath, { recursive: true, force: true });
          console.log(`   🧹 Cleaned up partial download: ${modelPath}`);
        }
      } catch (cleanupError) {
        console.error(`   ⚠️  Failed to clean up: ${cleanupError.message}`);
      }

      throw error;
    }
  }

  console.log('\n🎉 All models downloaded successfully!');
  console.log(`📊 Cache size: ${getCacheSizeMB(CACHE_DIR)} MB`);
}

function getCacheSizeMB(dir) {
  if (!fs.existsSync(dir)) return 0;

  let size = 0;
  const walk = (currentDir) => {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walk(filePath);
      } else {
        size += stat.size;
      }
    }
  };

  walk(dir);
  return (size / (1024 * 1024)).toFixed(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  downloadModels().catch((error) => {
    console.error('\n💥 Model download failed:', error);
    process.exit(1);
  });
}

export { downloadModels };

