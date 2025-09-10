@ECHO OFF
@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup script for Windows
@REM ----------------------------------------------------------------------------

setlocal
set MAVEN_WRAPPER_SCRIPT_DIR=%~dp0
set WRAPPER_JAR="%MAVEN_WRAPPER_SCRIPT_DIR%\.mvn\wrapper\maven-wrapper-3.2.0.jar"
set WRAPPER_PROPERTIES="%MAVEN_WRAPPER_SCRIPT_DIR%\.mvn\wrapper\maven-wrapper.properties"

IF NOT EXIST %WRAPPER_JAR% (
  echo [INFO] Baixando Maven Wrapper...
  powershell -Command "Invoke-WebRequest -OutFile %WRAPPER_JAR% https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar" || (
    echo [ERRO] Falha ao baixar maven-wrapper jar.& exit /b 1)
)

set JAVA_EXE=java
where java >nul 2>&1 || (echo [ERRO] Java nao encontrado no PATH.& exit /b 1)

%JAVA_EXE% -classpath %WRAPPER_JAR% org.apache.maven.wrapper.MavenWrapperMain %*
endlocal
