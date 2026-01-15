@echo off
echo Creating temporary deployment configuration...

echo [phases.setup] > nixpacks.toml
echo nixPkgs = ["nodejs"] >> nixpacks.toml
echo [phases.install] >> nixpacks.toml
echo cmds = ["npm install"] >> nixpacks.toml
echo [phases.build] >> nixpacks.toml
echo cmds = ["npm run build -w @audico/shared", "npm run build --workspaces --if-present"] >> nixpacks.toml
echo [start] >> nixpacks.toml
echo cmd = "node mcp-http-service/server.js" >> nixpacks.toml

copy railway.json railway.json.bak
echo { > railway.json
echo   "$schema": "https://railway.app/railway.schema.json", >> railway.json
echo   "build": { "builder": "NIXPACKS" }, >> railway.json
echo   "deploy": { >> railway.json
echo     "startCommand": "node mcp-http-service/server.js", >> railway.json
echo     "restartPolicyType": "ON_FAILURE", >> railway.json
echo     "restartPolicyMaxRetries": 3 >> railway.json
echo   } >> railway.json
echo } >> railway.json

echo Deploying to Railway (mcp-http-service)...
railway up --service mcp-http-service

echo Cleaning up...
del nixpacks.toml
copy railway.json.bak railway.json
del railway.json.bak

echo Deployment complete!
pause
