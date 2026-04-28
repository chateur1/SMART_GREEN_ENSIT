FROM node:20-alpine

LABEL description="Smart Green ENSIT — Frontend React"

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV REACT_APP_API_URL=http://localhost:8000/api

EXPOSE 3000

CMD ["npm", "start"]
