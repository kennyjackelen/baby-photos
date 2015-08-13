FROM    centos:centos6

# Enable EPEL for Node.js
RUN     rpm -Uvh http://download.fedoraproject.org/pub/epel/6/i386/epel-release-6-8.noarch.rpm

# Install Node.js and npm
RUN     yum install -y npm
RUN     yum install -y git

RUN npm install -g forever
RUN npm install -g bower

# Set up NPM first so we don't rebuild it every time some source code changes
COPY src/package.json /src/
RUN cd /src; npm install

# Set up Bower next so we don't rebuild it every time some source code changes
COPY src/bower.json /src/
RUN cd /src; bower install --allow-root

# Copy the rest of the source code--this is the cheapest operation and most likely to change
COPY src /src

EXPOSE  8080
CMD ["forever", "/src/index.js"]