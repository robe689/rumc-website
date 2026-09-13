@echo off
echo Installing dependencies...
call npm install
echo.
echo Starting RUMC website...
call npm start
pause
