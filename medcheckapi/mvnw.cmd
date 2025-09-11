@ECHO OFF
@REM ----------------------------------------------------------------------------
@REM Restored Maven Wrapper startup script for Windows (standard + fixes)
@REM ----------------------------------------------------------------------------

setlocal ENABLEDELAYEDEXPANSION

@REM Resolve base dir (directory of this script)
set MAVEN_WRAPPER_SCRIPT_DIR=%~dp0
for %%i in ("%MAVEN_WRAPPER_SCRIPT_DIR%.") do set MAVEN_PROJECTBASEDIR=%%~fi

@REM Multi-module project directory property so Maven stops complaining
set MAVEN_OPTS=-Dmaven.multiModuleProjectDirectory="%MAVEN_PROJECTBASEDIR%" %MAVEN_OPTS%

set WRAPPER_JAR="%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper-3.2.0.jar"
set WRAPPER_PROPERTIES="%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.properties"

IF NOT EXIST %WRAPPER_JAR% (
  echo [INFO] Downloading Maven Wrapper JAR...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $uri='https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar'; $out=\"%WRAPPER_JAR:~1,-1%\"; Invoke-WebRequest -Uri $uri -OutFile $out" || (
    echo [ERROR] Failed to download maven-wrapper JAR.& exit /b 1)
)

set JAVA_EXE=java
where java >nul 2>&1 || (echo [ERROR] Java not found in PATH.& exit /b 1)

@REM Launch wrapper main class
%JAVA_EXE% %MAVEN_OPTS% -classpath %WRAPPER_JAR% org.apache.maven.wrapper.MavenWrapperMain %*
set EXIT_CODE=%ERRORLEVEL%
endlocal & exit /b %EXIT_CODE%
