import React, { Component } from 'react';
import { Route, Switch, withRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import Profile from './Profile';
import Loading from './Loading';
import Login from './Login';

class App extends Component {
    
    render() {
        return (
            <Switch>
                <Route exact path="/login" component={Login}/>
                <Route path="/loading" component={Loading}/>
                <Route path="/profile" component={Profile}/>
                <Route path="/" component={Dashboard}/>
            </Switch>
        );
    }
}

export default withRouter(App);