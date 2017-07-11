# todoApi
This project is sample project that create a toDo rest api using node.js.

Also in docs folder there is doc that provide installation steps for major JAVA Script code  analysis tool.

Brief steps for code analysis using different tools are given below
1)	Plato (https://github.com/es-analysis/plato)

Steps for installation:

Go to the root folder of your project and run below command
 
 npm install -g plato  (installed globally )

 npm install plato –save-dev (installed locally)

Command for Code Analysis

Below command will generate code analysis report for all js files recursively. 
                    
plato -r -d report src 
(src is source directory of code and report will be generated in    report folder of your        project root folder) 
          
For mode options please visit https://github.com/es-analysis/plato
          
To view the reports go to the report folder and open index.html file

2) Code climate provide Java Script code analysis .It provide 15 days free trial for private git repository.
Steps for code analysis using code climate.
Go to the site of code climate https://codeclimate.com/oss/dashboard(detail in docs/ folder)

3) SonarJS analyser 
Download the sonar server stable version and start the sonar server.

Add the SonarJS analyser from sonar server admin UI.

Go to Administration->System->Update Center and search SonarJS plugin.

Download the sonar-runner and add the path of bin sonar-runner  to PATH variable.

path_to_ sonar-runner/bin

Go to root directory of project and run below command

sonar-runner -Dsonar.projectKey=<project_name> -Dsonar.sources=./<project_folder_name>/

Go to sonar server admin UI and see the project code analysis in projects tab.

4) Code Metrics - Visual Studio Code Extension

It can be interesting to see the complexity of method while developing the code. Visual Studio Code has an extension Code Metrics to 

view the complexity while developing the code.

Installation:

Launch VS Code Quick Open (Ctrl+P), paste the following command, and press enter.

ext install vscode-codemetrics

Commands
Toggle code lenses for arrow functions
Toggle code metrics

They can be bound in the keybindings.json 
( Go to  File -> Preferences -> Keyboard Shortcuts)

{ "key": "f4",                    "command": "codemetrics.toggleCodeMetricsForArrowFunctions",
                                     "when": "editorTextFocus" },
{ "key": "f5",                    "command": "codemetrics.toggleCodeMetricsDisplayed",
                                     "when": "editorTextFocus" }








Steps to run RETS APIs

Check out the code

Go to the root folder

Start the mongodb server

npm install

npm start 

 Open post man
 
GET 

 http://localhost:3001/tasks/
 
 [] //ouput
 
 POST using x-www-form-urlencoded
 
 name:Read nodejs server in 100 min
 
 status:pending
 
 //ouput
 {
    "_id": "595f5fe42f40da2c5c427e13",
    "name": "Read nodejs server in 10 min",
    "__v": 0,
    "status": [
        "pending"
    ],
    "Created_date": "2017-07-07T10:18:12.782Z"
}

GET  http://localhost:3001/tasks/

//output
{
    "_id": "595f5fe42f40da2c5c427e13",
    "name": "Read nodejs server in 10 min",
    "__v": 0,
    "status": [
        "pending"
    ],
    "Created_date": "2017-07-07T10:18:12.782Z"
}

DELETE  http://localhost:3001/tasks/595f5fe42f40da2c5c427e13  

//ouput
{
    "message": "Task successfully deleted"
}

PUT http://localhost:3001/tasks/59631278afdc6a20ac6fae13

 name:This is my server
 status:completed
 
 //output
 
 {
    "_id": "59631278afdc6a20ac6fae13",
    "name": "This is my server",
    "__v": 0,
    "status": [
        "completed"
    ],
    "Created_date": "2017-07-10T05:36:56.793Z"
}

//output

 
