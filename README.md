# OpenVPN for Docker
OpenVPN server in a Docker container complete with an EasyRSA PKI CA.

Forked from [kylemanna/docker-openvpn](https://github.com/kylemanna/docker-openvpn)\
A web GUI has been added for easy configuration.

## Quick Start

* Pick a name for the `$OVPN_DATA` data volume container. It's recommended to
  use the `ovpn-data-` prefix to operate seamlessly with the reference systemd
  service.  Users are encourage to replace `example` with a descriptive name of
  their choosing.

      OVPN_DATA="ovpn-data-example"

* Initialize the `$OVPN_DATA` container that will hold the configuration files
  and certificates.
  
      docker volume create --name $OVPN_DATA

* Start OpenVPN server process

      docker run -v $OVPN_DATA:/etc/openvpn -d -p 1194:1194/udp -p 8080:8080/tcp --cap-add=NET_ADMIN sasodoma/openvpngui

* A GUI becomes avaliable on port 8080
