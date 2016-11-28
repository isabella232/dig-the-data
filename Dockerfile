FROM receiptful/base:node-6.9.1

WORKDIR /app/user

RUN apt-get update && apt-get install -y vim
