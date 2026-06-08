import uvicorn
uvicorn.run("main:app", host="0.0.0.0", port=8000, log_level="debug")