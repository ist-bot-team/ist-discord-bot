@echo off
setlocal enabledelayedexpansion

if exist version (
    set /p foo=<version
    set /A foo=foo+1
    echo Version: !foo!
    (echo !foo!)>version
) else (
    (echo 0)>version
)

python ./build.py --no-loop

git add .
git commit -am "Changes"
git push origin dev
