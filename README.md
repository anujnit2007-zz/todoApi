# todoApi
This project is sample project that create a toDo rest api using node.js.

Also in docs folder there is doc that provide installation steps for major JAVA Script code  analysis tool.

Steps:

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

 
