sudo apt-get update
sudo apt-get upgrade
curl -sL https://deb.nodesource.com/setup | sudo bash -
sudo apt-get install nodejs
sudo npm install pm2 -g
cd /home/pi
git clone https://github.com/whatcomtrans/nodeOnPiOnABus
mkdir queue
cd /home/pi/nodeOnPiOnABus
pull.sh
