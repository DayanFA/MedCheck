# Passo 1: Usa um computador com Maven e Java 17 para compilar
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

# Passo 2: Usa um computador mais leve só para rodar o projeto pronto
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

# A porta padrão do Spring Boot
EXPOSE 8080

# Comando para ligar a API COM LIMITE DE MEMÓRIA (256MB)
ENTRYPOINT ["java", "-Xms256m", "-Xmx256m", "-jar", "app.jar"]