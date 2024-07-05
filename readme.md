# AOKillboard-DiscordBot

A Discord bot for Albion Online's kill board.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

![image](https://github.com/pierrefeza/AOKillBoard-DiscordBot/assets/174371609/7540fa1f-c292-4e18-812b-db23c80f66e0)
![image](https://github.com/pierrefeza/AOKillBoard-DiscordBot/assets/174371609/f8840047-aaf0-4b30-864e-afe4592831a8)




### Usage

* `!ping` - replies with @user pong
* `!kbclear` - deletes all messages in the config.botChannel
* `!kbinfo <eventId>` - displays the kill board post for a specific kill to the current channel

### Prerequisites

* [NodeJS](https://nodejs.org/)
* [Docker](https://www.docker.com/)
* [AWS CLI](https://aws.amazon.com/cli/) (for running on EC2)
* [SSH Client](https://www.ssh.com/ssh/putty/windows/) (for connecting to EC2)

### Installing

#### 1. Local Setup

1. **Clone the repository:**
   ```sh
   git clone https://github.com/pierrefeza/AOKillBoard-DiscordBot.git
   cd AOKillBoard-DiscordBot

2. **Install Node.js dependencies:**
    ```sh
    npm install

3. **Create a new Discord Application:**
    * Visit [the Discord Developer Portal](https://discordapp.com/developers/applications/) 
    * Create a new application and add a bot to it.
    * Copy the 'BOT' token

4. **Set up your `config.json`:**
    * Copy `config.json.example` to `config.json`
    * Update `config.json` with your bot token, botChannel, and other necessary details.

    Example `config.json`:
    ```{
    "cmdPrefix": "!",
    "allianceName": "<NONE>",
    "guildName": "8-bit",
    "username": "AOKillBoard-DiscordBot",
    "admins": [
        "ADMIN_ID"
    ],
    "botChannel": "445822300890946337",
    "playingGame": "Albion Killboard Bot",
    "token": "YOUR_DISCORD_BOT_TOKEN"
    }```

### 2. Running with Docker Locally

1. **Build the Docker image:**
    ```sh
    docker build -t aokillboard-discordbot .

2. **Run the Docker container:**
    ```sh
    docker run -d --name aokillboard-discordbot aokillboard-discordbot 

3. **Check the logs:**
    ```sh
    docker logs -f aokillboard-discordbot

4. **Summary commands**
    ```sh
    docker stop aokillboard-discordbot
    docker rm aokillboard-discordbot
    docker build -t aokillboard-discordbot .
    docker run -d --name aokillboard-discordbot aokillboard-discordbot
    docker logs -f aokillboard-discordbot

### 3. Running on AWS EC2

1. **Launch an EC2 instance:**

    * Use the AWS Management Console to launch an EC2 instance with Amazon Linux 2 AMI
    * Ensure the instance has a security group that allows inbound SSH (port 22) and the port your bot will use (usually 443 for HTTPS)

2. **Connect to your EC2 instance:**
    ```sh
    ssh -i /path/to/your-key-pair.pem ec2-user@your-ec2-public-ip

3. **Install Docker on EC2:**
    ```sh
    sudo yum update -y
    sudo amazon-linux-extras install docker
    sudo service docker start
    sudo usermod -a -G docker ec2-user

4. **Logout and login again to apply the Docker group changes:**
    ```sh
     exit
    ssh -i /path/to/your-key-pair.pem ec2-user@your-ec2-public-ip

5. **Install Node.js dependencies for buildiung the Docker image:**
    ```sh
    sudo yum install -y gcc-c++ make
    curl -sL https://rpm.nodesource.com/setup_16.x | sudo bash -
    sudo yum install -y nodejs

6. **Clone the repository on EC2:**
    ```sh
    git clone https://github.com/pierrefeza/AOKillBoard-DiscordBot.git
    cd AOKillBoard-DiscordBot

7. **Copy your local `config.json` to the EC2 instance:**
    ```sh
    scp -i /path/to/your-key-pair.pem /path/to/your/config.json ec2-user@your-ec2-public-ip:/home/ec2-user/AOKillBoard-DiscordBot/

8. **Build the Docker image on EC2:**
    ```sh
    docker build -t aokillboard-discordbot .

9. **Run the Docker container on EC2:**
    ```sh
    docker run -d --name aokillboard-discordbot aokillboard-discordbot

10. **Check the logs to ensure the bot is running:**
    ```sh
    docker logs -f aokillboard-discordbot


 11. **Commands to clean docker env***
      ```sh
      docker image prune -a -f
      docker container prune -f
      docker volume prune -f
      docker network prune -f
      docker system prune -a -f


### Built With

* [Discord.js](https://github.com/hydrabolt/discord.js/) - Discord app library for Node.js and browsers.
* [Axios](https://axios-http.com/docs/intro) - Promise-based HTTP Client for node.js

## Credits

* Current working state by [Pierre Donal Feza](https://github.com/pierrefeza) Discord: **yokokosparda**
* [UI Layout inspiration](https://albion-killbot.com) - albion-killbot
* [Initial Implementation](https://github.com/bearlikelion/ao-killbot/) from **Mark Arneman**





