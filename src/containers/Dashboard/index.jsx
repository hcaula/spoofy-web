import React, { Component } from 'react';
import { withRouter, Redirect } from 'react-router-dom';
import { Sidebar, Button, Menu, Icon } from 'semantic-ui-react';
import Graph from './components/Graph';
import SongRow from './components/SongRow';
import { API } from '../../utils';
import Slider from 'rc-slider';
import './index.css';
import 'rc-slider/assets/index.css';

const getSpotifyIframe = (uri) => {
    return (
        <iframe
            className='spotify-iframe'
            title='spotify-iframe'
            src={`https://open.spotify.com/embed?uri=${uri}`}
            width='83%'
            height={80}
            frameBorder={0}
            allowtransparency="true"
            allow="encrypted-media"
        />
    );
}

class Dashboard extends Component {

    state = {
        visible: false,
        ready: false,
        playlistReady: true,
        users: [],
        playlist: [],
        spotifyIframe: "",
        defaultLinkWeight: 8,
        exporting: false,
        exported: false
    }

    componentDidMount() {
        this.loadData();
    }

    logout = () => { this.setState({ redirect: true }); }

    toggleVisibility = () => this.setState({ visible: !this.state.visible })

    loadData = async () => {
        const users = await API.getAllUsers();
        if (users) this.setState({ ready: true, users });
        else this.setState({ redirect: true });
    }

    registerVote = async (song, vote) => {
        try {
            await API.registerVote(this.state.playlist_id, song, vote);
        } catch (error) {
            console.log(error);
            alert("It wasn't possible to register vote for this track at this moment.");
        }
    }

    exportPlaylist = async () => {
        try {
            this.setState({ exporting: true, exported: false });
            await API.exportPlaylist(this.state.playlist_id);
            this.setState({ exporting: false, exported: true });
        } catch (error) {
            console.log(error);
            alert("It wasn't possible to export this playlist at this moment.");
        }
    }

    getPlaylist = async (selected) => {
        try {
            this.setState({ playlistReady: false, exporting: false, exported: false });

            /* Automatically toggles playlist sidebar */
            if (!this.state.visible && selected.length === 1) this.toggleVisibility();

            const ids = selected.map(s => s.id);
            const multipliers = selected.map(s => s.multiplier);
            const body = await API.getPlaylist(ids, multipliers);

            if (this.state.playlist.length === 0) {
                const uri = body.playlist[0].uri;
                this.setState({ spotifyIframe: getSpotifyIframe(uri) });
            }

            this.setState({
                playlist: body.playlist,
                playlist_id: body._id,
                seeds: body.seeds,
                playlistReady: true
            });


        } catch (err) {
            if (err.status === 401) {
                alert("Your Spotify token has expired. Please, login again.");
                this.setState({ redirect: true });
            } else {
                console.log(err);
                alert("It wasn't possible to generate a playlist for the selected users. Please, select others.");
            }
        }
    }

    handleSongSelect = (song) => {
        this.setState({
            spotifyIframe: getSpotifyIframe(song.uri)
        })
    }

    handleSliderChange = (e) => {
        this.setState({
            defaultLinkWeight: e
        })

        this.refs.graph.drawGraph();
        this.refs.graph.setNodesAndLinks(e);
    }

    clearSelected = () => {
        this.refs.graph.clearSelected();
    }

    redrawGraph = () => {
        this.refs.graph.clearSelected();
        this.refs.graph.drawGraph();
    }

    focusLoggedUser = () => {
        this.refs.graph.focusLoggedUser();
    }

    render() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const min_width = 785;
        const max_sidebar_width = 475;
        const sidebar_width = (Math.min(width, max_sidebar_width));

        const { visible } = this.state;

        const user = API.getUser();

        if (!user || this.state.redirect) return <Redirect to="/login" />

        let playlistDiv;
        if (!this.state.playlistReady) {
            playlistDiv = (
                <div className="loadingPlaylist">
                    <Icon name='circle notched loading icon' size="large" />
                    <h3>loading playlist...</h3>
                </div>
            )
        } else if (this.state.playlist.length === 0) {
            playlistDiv = (
                <div className="emptyPlaylist">
                    <h1>playlist is empty</h1>
                    <h4>please, select users so that we can generate a playlist for you</h4>
                </div>
            )
        } else {
            playlistDiv = (
                <div className='songs' style={{ height: height - 80 }}>
                    {this.state.playlist.map((s, i) =>
                        <SongRow index={i} registerVote={this.registerVote} width={sidebar_width} key={i} song={s} onClick={this.handleSongSelect} />
                    )}
                </div>
            )
        }

        let exportButton;
        if (this.state.exporting || !this.state.playlistReady) exportButton = (<div><Icon className="exportLoading" name="circle notched loading icon" size="large" /></div>);
        else if (this.state.exported) exportButton = (<div>playlist exported! <Icon className="exportCheck" name="check" /></div>);
        else exportButton = (<div>export playlist <Icon className="exportIcon" name="spotify" size='large' /></div>);

        const dashboardOptions = (
            <div>
                <h1>{`hi, ${user.display_name.toLowerCase()}`}</h1>
                <h3 onClick={this.logout} className="DashboardOption">logout</h3>
            </div>
        )

        return (
            <Sidebar.Pushable>

                <div className="Dashboard">
                    <div className="DashboardTitle">
                        {width > min_width ? dashboardOptions : ''}
                        <p>minimum genre-user affinity: <b>{this.state.defaultLinkWeight}</b></p>
                        <div>
                            <Slider
                                min={5}
                                max={20}
                                defaultValue={this.state.defaultLinkWeight}
                                step={1}
                                onChange={(e) => this.handleSliderChange(e)}
                            />
                        </div>
                    </div>

                    <div className="focus-button">
                        <div className="ui buttons">
                            <Button className="ui button" data-tooltip="focus on you" data-position="bottom center" onClick={this.focusLoggedUser} icon>
                                <Icon name="crosshairs" />
                            </Button>
                            <Button className="ui button" data-tooltip="clear selected users" data-position="bottom center" onClick={this.clearSelected} icon>
                                <Icon name="user times" />
                            </Button>
                            <Button className="ui button" data-tooltip="redraw graph" data-position="bottom center" onClick={this.redrawGraph} icon>
                                <Icon name="redo alternate" />
                            </Button>
                        </div>
                    </div>

                    <div className="sidebar-toggle">
                        <Button onClick={this.toggleVisibility} icon>
                            {visible ?
                                <Icon name='angle right' /> :
                                <Icon name='angle left' />
                            }
                        </Button>
                    </div>

                    {!this.state.ready ? null :
                        <Graph
                            ref='graph'
                            users={this.state.users}
                            user={user}
                            width={width}
                            height={height}
                            getPlaylist={this.getPlaylist}
                            defaultLinkWeight={this.state.defaultLinkWeight}
                        />
                    }
                </div>

                <Sidebar
                    as={Menu}
                    animation='overlay'
                    direction='right'
                    visible={visible}
                    icon='labeled'
                    vertical
                    inverted
                    id="sidebar"
                    style={{ width: sidebar_width }}
                >
                    <div className='playlist'>
                        <div className='play'>
                            {(this.state.playlist.length > 0 && !this.state.trackSelected) ?
                                (<div className="spotifyArea">
                                    <Button onClick={this.exportPlaylist} className="exportButton">{exportButton}</Button>
                                    {this.state.spotifyIframe}
                                </div>
                                ) :
                                <div style={{ margin: 10 }}><Icon name='spotify' size='huge' /></div>}
                        </div>
                        <div style={{height: "30px"}}>
                            {(this.state.seeds ? this.state.seeds.join(', ') : "")}
                        </div>
                    {playlistDiv}
                    </div>
                </Sidebar>

            </Sidebar.Pushable >
        );
    }
}

export default withRouter(Dashboard);