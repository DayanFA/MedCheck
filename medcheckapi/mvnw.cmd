@ECHO OFF
@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup script for Windows
@REM ----------------------------------------------------------------------------

setlocal
set MAVEN_WRAPPER_SCRIPT_DIR=%~dp0
set WRAPPER_JAR="%MAVEN_WRAPPER_SCRIPT_DIR%\.mvn\wrapper\maven-wrapper-3.2.0.jar"
set WRAPPER_PROPERTIES="%MAVEN_WRAPPER_SCRIPT_DIR%\.mvn\wrapper\maven-wrapper.properties"
set WRAPPER_JAR_PATH=%MAVEN_WRAPPER_SCRIPT_DIR%\.mvn\wrapper\maven-wrapper-3.2.0.jar

IF NOT EXIST %WRAPPER_JAR% (
  echo [INFO] Baixando Maven Wrapper...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $uri='https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar'; $out=\"%WRAPPER_JAR_PATH%\"; Invoke-WebRequest -Uri $uri -OutFile $out" || (
    echo [ERRO] Falha ao baixar maven-wrapper jar.& exit /b 1)
)

set JAVA_EXE=java
where java >nul 2>&1 || (echo [ERRO] Java nao encontrado no PATH.& exit /b 1)

%JAVA_EXE% -classpath %WRAPPER_JAR% org.apache.maven.wrapper.MavenWrapperMain %*
endlocal
