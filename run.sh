cd src/credentials
npm install
node ./init-token.js
cd ../..
docker-compose build
docker-compose up -d
sleep 1
echo http://$(boot2docker ip):49160
