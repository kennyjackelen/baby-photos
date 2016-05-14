FROM nodesource/node:5

RUN node -v

RUN npm install -g forever
RUN npm install -g bower
RUN npm install -g gulp

# Set up NPM first so we don't rebuild it every time some source code changes
COPY src/package.json /src/
RUN cd /src; npm install

# Set up Bower next so we don't rebuild it every time some source code changes
COPY src/bower.json /src/
RUN cd /src; bower install --allow-root

# Copy the rest of the source code--this is the cheapest operation and most likely to change
COPY src /src

RUN cd /src; gulp build

EXPOSE  8080
CMD ["forever", "/src/index.js"]