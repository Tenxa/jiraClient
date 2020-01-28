// No, 5.5 tulikin tehtyä heti kärkeen

import React from 'react'
import LoginComponent from './components/login'
import loginService from './services/login'
import JiraComponent from './components/jiraClient'
import UserComponent from './components/user'
import DevLabsComponent from './components/devlabs'
import AsopComponent from './components/asop'
import IssueComponent from './components/issue'
import jiraService from './services/jiras'
const utils = require('./utils/utils.js')

class App extends React.Component {
  constructor(props) {

    try {
      super(props)
      const cachedUser = utils.getUserFromMemory()
      console.log('cachedUser', cachedUser);
      this.state = {
          username: '',
          password: '',
          user: cachedUser,
          hideWhenLoggedIn: utils.displayNormal(),
          showWhenLoggedIn: utils.displayNone(),
          token: null,
          counter: 0,
          issues: null,
          fetchedPassword: cachedUser ? cachedUser.password : null,
          issues: null,
        }
      this.handleLoginResult = this.handleLoginResult.bind(this)
      this.setNotification = this.setNotification.bind(this)
      this.clearmessages = this.clearmessages.bind(this)
      this.loginFromCache = this.loginFromCache.bind(this)
      this.toggleVisibility = this.toggleVisibility.bind(this)
      this.jiraButtonClicked = this.jiraButtonClicked.bind(this)
      this.dataButtonClicked = this.dataButtonClicked.bind(this)
      this.devlabsButtonClicked = this.devlabsButtonClicked.bind(this)
      this.asopButtonClicked = this.asopButtonClicked.bind(this)
      this.getChangeLog = this.getChangeLog.bind(this)
    }
    catch (e) {
      console.log(e);
    }

  }

jiraButtonClicked = async(evt, myFile, token) => {
    console.log('in jbc token', token);
    console.log('in jbc token', this.state.token);
    evt.preventDefault()

    var reader = new FileReader();
    reader.token = this.state.token

    reader.onload = (function(f) {
        return function(e) {
          console.log('in onload', this.token);
          const lineArray = e.target.result.split('¤¤')
          const resultArray = []
          lineArray.map(line => {
            //console.log(this);
            resultArray.push(utils.lineToIssue(line))
          })
          const resultObjectArray = utils.createIssueArray(resultArray)
          const result = jiraService.postIssue(this.token, resultObjectArray)
          console.log('result', result);
        };
    })(myFile);

    reader.readAsText(myFile);

    //await jiraService.authenticate(this.state.token)
    const issue = await jiraService.getIssue(this.state.token, 'LC-4')
    console.log('issue', issue);
  }

  devlabsButtonClicked = async(evt, myFile, token) => {
      evt.preventDefault()

      //await jiraService.authenticate(this.state.token)
      const issue = await jiraService.getAllDevLabsIssues(this.state.token)
      this.setState({issues: issue.issue.issues})

      // get change history
      this.state.issues.map(issue => {
          this.getChangeLog(issue.key)
        })

    }

    getChangeLog = async(id) => {
      let changeLog = await jiraService.getDevLabsIssueChangeLog(this.state.token, id)
      console.log(changeLog);

    }

    asopButtonClicked = async(evt, myFile, token) => {
        evt.preventDefault()

        //await jiraService.authenticate(this.state.token)
        const issue = await jiraService.getAsopIssue(this.state.token, 'IPSLACE-2')
        console.log('issue', issue);
      }

  dataButtonClicked = async(evt, myFile, token) => {
      console.log('in jbc token', token);
      console.log('in jbc token', this.state.token);
      evt.preventDefault()

      //await jiraService.authenticate(this.state.token)
      const issue = await jiraService.getIssue(this.state.token, 'LC-8')
      console.log('issue', issue);
    }

  toggleVisibility = (id) => {
    console.log('id is vis', id)
    const pivotIssues = this.state.issues
    const index = pivotIssues.findIndex(blog => blog.id == id)
    if (index > -1) {
      if (typeof pivotIssues[index].visibility == 'undefined') {
        pivotIssues[index].visibility = false
      }
      pivotIssues[index].visibility =  !pivotIssues[index].visibility
    }
    this.setState({
      issues: pivotIssues
    })
  }

  componentDidMount = async() => {
    if (this.state.user) {
      await this.loginFromCache(this.state.user)
    }
  }

  loginFromCache = async(cachedUser) => {
    try {
      const result = await loginService.login(cachedUser)
      this.handleLoginResult(result)
      this.setNotification('kirjautuminen onnistui')
    }
    catch(e) {
      this.setNotification('NA', 'kirjautuminen epäonnistui')
    }
    const result = await loginService.login(cachedUser)
    this.handleLoginResult(result)
  }

  clearmessages() {
  this.setState({
    successtext: null,
    errortext: null
  })
}

  handleLoginResult = async(result) => {
    console.log('do we get here in tests?');
    try {
      let loggedInUser = null
      if (result.token) {
        loggedInUser = {
          name: result.name,
          username: result.username,
          password: result.password
        }
        utils.setUserToMemory(loggedInUser)

      }
      else {
        return
      }

      this.setState({
          hideWhenLoggedIn: utils.displayNone(),
          showWhenLoggedIn: utils.displayNormal(),
          user: loggedInUser,
          username: '',
          password: '',
          token: 'bearer ' + result.token,
          counter: this.state.counter + 1,
        })
    }
    catch (e) {
      console.log(e);
    }

  }

  setNotification = (notification, error) => {
    if (!error) {
    this.setState({
  					successtext: notification
  				})

  				setTimeout(() => {
  					this.clearmessages()
  				}, 3000)
  	}
  	else {
  				console.log(error)
  				this.setState({
  					errortext: error
  				})
  				setTimeout(() => {
  					this.clearmessages()
  				}, 3000)
  		}
  }

  render() {

    try {
      console.log('this.state in render', this.state);
      let user = {'username': this.state.username, 'password': this.state.password}
      let userName = undefined
      if (this.state.user) {
        userName = this.state.user.username
      }

      return (
      <div>
        <Notification message={this.state.successtext} error={this.state.errortext} />
        <div style={this.state.hideWhenLoggedIn}>
          <LoginComponent user={user} loginHandle = {this.handleLoginResult}/>
        </div >
        <div  style={this.state.showWhenLoggedIn}>
          <UserComponent user={this.state.user} />
        </div>
        <div style={this.state.showWhenLoggedIn}>
            <JiraComponent jiraButtonClicked={this.jiraButtonClicked} dataButtonClicked={this.dataButtonClicked} devlabsButtonClicked={this.devlabsButtonClicked}/>
        </div>
        <div style={this.state.hideWhenLoggedIn}>
          <DevLabsComponent devlabsButtonClicked={this.devlabsButtonClicked}/>
        </div >
        <div style={this.state.hideWhenLoggedIn}>
          <AsopComponent asopButtonClicked={this.asopButtonClicked}/>
        </div >
        <div style={this.state.showWhenLoggedIn}>
          <IssueComponent issues={this.state.issues} toggleVisibility={this.toggleVisibility}/>
        </div >
      </div>
      )
    }
    catch (e) {
      console.log(e)


    }
  }
}

const Notification = ({ message, error }) => {
  if (message === null && error === null) {
    return null
  }
  else if (message === null) {
	  return (
		<div className="error">
		  {error}
		</div>
	  )
  }
  else {
	return (
		<div className="note">
		  {message}
		</div>
	  )
  }
}

export default App;
