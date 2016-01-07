#Bash script to update the repo and reset PM2
pm2 stop all
pm2 flush
pm2 delete index
sudo chattr -i /home/pi/.pm2/dump.pm2
rm -rf /home/pi/.pm2
sudo npm install -g pm2
cd /home/pi/nodeOnPiOnABus
git pull https://github.com/whatcomtrans/nodeOnPiOnABus
pm2 start index.js
pm2 save
sudo chattr +i /home/pi/.pm2/dump.pm2
Sudo su -c "env PATH=$PATH:/usr/local/bin PM2_HOME=/home/pi/.pm2 pm2 startup linux -u pi"
