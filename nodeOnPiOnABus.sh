#! /bin/sh
# /etc/init.d/nodeOnPiOnABus

### BEGIN INIT INFO
# Provides:          index.js
# Required-Start:    $remote_fs $syslog
# Required-Stop:     $remote_fs $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Starts index.js
# Description:       Start / stop index.js at boot / shutdown.
### END INIT INFO

# If you want a command to always run, put it here

# Carry out specific functions when asked to by the system
case "$1" in
   start)
    echo "Starting index.js"
    # run application you want to start
    #node /home/pi/nodeOnPiOnABus/index.js > /home/pi/nodeOnPiOnABus/index.log
    /usr/local/node /home/pi/nodeOnPiOnABus/index.js >> /home/pi/nodeOnPiOnABus/index.log
   ;;
   stop)
    echo "Stopping index.js"
    # kill application you want to stop
    killall -9 node
    # Not a great approach for running
    # multiple node instances
    ;;
  *)
    echo "Usage: /etc/init.d/nodeOnPiOnABus {start|stop}"
    exit 1
    ;;
esac

exit 0