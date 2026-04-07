@echo off
cd /d C:\Users\homer\ccos-ratos
node scripts/pipeline-diario.mjs >> logs\pipeline.log 2>&1
