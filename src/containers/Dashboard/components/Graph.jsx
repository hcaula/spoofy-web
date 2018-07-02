import React, { Component } from 'react';
import { select, selectAll } from 'd3-selection';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { drag } from 'd3-drag';
import { zoom, zoomIdentity } from 'd3-zoom';
import { scaleLinear } from 'd3-scale';
import { event, extent } from 'd3';

import everynoise1 from '../../../assets/jsons/everynoise1.json';
import everynoise2 from '../../../assets/jsons/everynoise2.json';
import { GraphHelper } from '../../../utils/';

import GenHTML from './InfoHTML'

import up_arrow from '../../../assets/imgs/up.png';
import down_arrow from '../../../assets/imgs/down.png';

class Graph extends Component {

    constructor(props) {
        super(props);

        this.getPlaylist = this.props.getPlaylist;

        /* Logged user */
        this.user = this.props.user;

        /* All the users in our system */
        this.users = this.props.users;

        /* The minimum weight to which have a link between an user and a genre */
        this.default_weight = 4;

        /* Selected users */
        this.selected = [];

        this.multiplier_range = [1, 10];
        this.multiplier_med = Math.floor((this.multiplier_range[0] + this.multiplier_range[1]) / 2);
    }

    addOrRemove(g) {
        const index = GraphHelper.searchByField(g.id, 'id', this.selected);
        if (index < 0) this.selected.push({
            id: g.id,
            multiplier: this.multiplier_med
        });
        else this.selected.splice(index, 1);

        if (this.selected.length > 0) this.getPlaylist(this.selected);

        return index < 0;
    }

    addOrDecMultiplier(u, func) {
        const index = GraphHelper.searchByField(u.id, "id", this.selected);
        let value = (index >= 0 ? this.selected[index].multiplier : -1);
        if (func === 'up' && value < this.multiplier_range[1]) value++;
        if (func === 'down' && value > this.multiplier_range[0]) value--;

        if (this.selected[index].multiplier !== value) {
            this.selected[index].multiplier = value;
            this.getPlaylist(this.selected);
        }

        return value;
    }

    componentDidMount() {

        /* Preparing the genre nodes based on the users' genres */
        this.genreNodes = GraphHelper.setGenreNodes(this.users, this.default_weight);

        /* Preparing the user nodes */
        this.userNodes = GraphHelper.setUserNodes(this.users);

        /* Concatenate genre and user nodes */
        this.nodes = this.genreNodes.concat(this.userNodes)

        /* Create the links between the nodes */
        this.links = GraphHelper.setLinks(this.users, this.genreNodes, this.default_weight);

        this.linkNodes = GraphHelper.setLinkNodes(this.links, this.nodes);

        /* Call familiar D3 function */
        this.drawGraph();
    }

    drawGraph() {
        const users_length = this.users.length;
        const svg = select('svg');
        const width = +svg.attr("width");
        const height = +svg.attr("height");
        const graph = svg.append('g');

        /* Size of the user circle radius */
        const user_radius = 75;

        /* Size of the user info div */
        const div_height = 200;
        const div_width = 300;
        const div_font_size = 10;

        const slider_height = 25;
        const slider_width = user_radius + 50;
        const mult_btn_height = slider_height;
        const mult_val_size = slider_height;

        /* Initial scale for zoom */
        const initial_zoom = 0.4;
        let current_zoom = initial_zoom;

        /* Getting max and min values for everynoise genre positions */
        const ex_top = extent(everynoise1.genres.map(n => n.top));
        const ex_left = extent(everynoise1.genres.map(n => n.left));

        /* Creating colour scales */
        const green_scale = scaleLinear()
            .domain([ex_top[0], ex_top[1]])
            .range([0, 255]);

        const blue_scale = scaleLinear()
            .domain([ex_left[0], ex_left[1]])
            .range([0, 255]);

        /* Physics simualations properties */
        const simulation = forceSimulation()
            .force('link', forceLink().id(d => d.id)
                .strength(0.8)
                .distance(d => 20))
            .force('charge', forceManyBody())
            .force('center', forceCenter(width / 2, height / 2))
            .force('collision', forceCollide().radius(d => 500));

        /* Calls 'ticked' function every subsecond */
        simulation
            .nodes(this.nodes)
            .on("tick", ticked);

        /* Forces links */
        simulation.force("link")
            .links(this.links)

        /* Creates links SVG elements */
        const link = graph.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(this.links)
            .enter().append("line")
            .attr("stroke-width", d => Math.sqrt(d.weight))
            .attr("class", "link")

        /* Creates genre nodes SVG circle */
        const g_node = graph.append("g")
            .attr("class", "g_nodes")
            .selectAll("circle")
            .data(this.genreNodes)
            .enter()
            .append('circle')
            .attr('r', g => g.weight ? getRadius(g.weight) : user_radius)
            .attr('fill', g => {
                if (everynoise2[g.name]) {
                    const red = 125;
                    const green = parseInt(green_scale(everynoise2[g.name].top), 10);
                    const blue = parseInt(blue_scale(everynoise2[g.name].left), 10);
                    return `rgb(${red},${green},${blue})`;
                } else return 'white';
            })
            .attr("class", 'genre')
            .attr("id", g => `node_${g.id}`)
            .on("click", g => {
                svg.transition()
                    .duration(500)
                    .call(zoom_svg.translateTo, g.x, g.y)
                    .transition(500)
                    .call(zoom_svg.scaleTo, initial_zoom);
            })
            .call(drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))

        /* Creates user nodes SVG images */
        const u_node = graph.append("g")
            .attr("class", "u_nodes")
            .selectAll("circle")
            .data(this.userNodes)
            .enter()
            .append('foreignObject')
            .attr("transform", `translate(-${user_radius / 2},-${user_radius / 2})`)
            .attr('class', 'u_img')
            .attr('height', user_radius)
            .attr('width', user_radius)
            .attr('id', u => `fo_${u.id}`)
            .append('xhtml:img')
            .attr("height", "100%")
            .attr("width", "100%")
            .attr('src', u => u.image)
            .attr("id", g => `node_${g.id}`)
            .style('border-radius', '100%')
            .style('border', u => (u.id === this.user._id) ? '5px solid red' : '')
            .on("mouseover", g => {
                select(`#info_${g.id}`)
                    .style("display", "");
            })
            .on("mouseout", g => {
                select(`#info_${g.id}`)
                    .style("display", "none");
            })
            .on("click", g => {
                const added = this.addOrRemove(g);

                select(`#node_${g.id}`)
                    .style('border', (added ? '20px solid green' : ''));

                select(`#slider_${g.id}`)
                    .style('display', (added ? '' : 'none'));

                if (added) select(`#mult_${g.id}`).html(this.multiplier_med);

                svg.transition()
                    .duration(500)
                    .call(zoom_svg.translateTo, g.x, g.y)
                    .transition(500)
                    .call(zoom_svg.scaleTo, initial_zoom);
            })
            .call(drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        graph.append("g")
            .attr("class", "divs")
            .selectAll("circle")
            .data(this.userNodes)
            .enter()
            .append("foreignObject")
            .style("display", "none")
            .attr("id", d => `info_${d.id}`)
            .attr("class", "user_info")
            .attr('height', "1000px")
            .attr('width', "1000px")
            .append("xhtml:div")
            .attr("height", "100%")
            .attr("width", "100%")
            .html(d => GenHTML.userInfo(d.user))

        graph.append("g")
            .attr("class", "sliders")
            .selectAll("circle")
            .data(this.userNodes)
            .enter()
            .append("foreignObject")
            .style("display", "none")
            .attr("id", d => `slider_${d.id}`)
            .attr("class", 'sliderDiv')
            .attr('height', slider_height)
            .attr('width', slider_width)
            .append("xhtml:div")
            .attr("height", "100%")
            .attr("width", "100%")
            .attr("class", "multipliersDiv");

        graph
            .selectAll('.multipliersDiv')
            .append("xhtml:img")
            .attr("src", down_arrow)
            .attr("class", "mult_button")
            .on('click', u => {
                select(`#mult_${u.id}`)
                    .html(this.addOrDecMultiplier(u, 'down'));
            });

        graph
            .selectAll('.multipliersDiv')
            .append("xhtml:div")
            .attr('id', u => `mult_${u.id}`)
            .html(this.multiplier_med);

        graph
            .selectAll('.multipliersDiv')
            .append("xhtml:img")
            .attr('src', up_arrow)
            .attr("class", "mult_button")
            .on('click', u => {
                select(`#mult_${u.id}`)
                    .html(this.addOrDecMultiplier(u, 'up'));
            });

        // const linkNode = graph.append("g")
        //     .attr("class", "link-node")
        //     .selectAll("circle")
        //     .data(this.linkNodes)
        //     .enter()
        //     .append("circle")
        //     .attr("class", "link-node")
        //     .attr("r", 20)
        //     .style("fill", "#ccc")

        /* Appends texts SVG elements to genre nodes */
        const text = graph.append("g")
            .attr("class", "texts")
            .selectAll("circle")
            .data(this.genreNodes)
            .enter()
            .append("text")
            .attr('class', 'txt')
            .attr('id', d => `txt_${d.id}`)
            .text(d => d.name)
            .attr("text-anchor", "middle")

        /* Zoom simulaton */
        const zoom_svg = zoom()
            .on("zoom", () => {
                current_zoom = event.transform.k;

                graph.attr('transform', event.transform)

                /* Forces users' nodes to remain a constant size */
                selectAll('.u_img')
                    .attr('height', () => user_radius / event.transform.k)
                    .attr('width', () => user_radius / event.transform.k)

                /* Forces user info div to remain a constant size and always above user image */
                selectAll('.user_info')
                    .attr('height', () => div_height / event.transform.k)
                    .attr('width', () => div_width / event.transform.k)
                    .attr('x', d => d.x - (div_width / 2) / current_zoom)
                    .attr('y', d => d.y - (div_height / current_zoom) - (user_radius / 2) / current_zoom)
                    .style('font-size', div_font_size / current_zoom);

                selectAll(".sliderDiv")
                    .attr('height', () => slider_height / event.transform.k)
                    .attr('width', () => slider_width / event.transform.k)
                    .attr('x', d => d.x - (slider_width / 2) / current_zoom)
                    .attr('y', d => d.y + (user_radius / 2) / current_zoom)
                    .style('font-size', mult_val_size / current_zoom);

                selectAll(".mult_button")
                    .attr('style', () => {
                        const height = mult_btn_height / current_zoom;

                        return `height:${height}px`;
                    });

                /* Translates images after zoom */
                const val = user_radius / event.transform.k / 2;
                selectAll('.u_img')
                    .attr("transform",
                        `translate(-${val},-${val})`);

                selectAll('.genre')
                    .style('opacity', d => {
                        const ratio = d.weight / 4;
                        return event.transform.k * ratio
                    });

                selectAll('.link')
                    .style('opacity', event.transform.k);

                selectAll('.txt')
                    .style('opacity', d => {
                        const ratio = d.weight / 4;
                        return event.transform.k * ratio
                    });
            });

        /* Calls zoom simulation */
        svg.call(zoom_svg)
            .call(zoom_svg.transform,
                zoomIdentity
                    .translate(width * initial_zoom, height * initial_zoom)
                    .scale(initial_zoom));

        /* Function that happens every subsecond */
        function ticked() {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            g_node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            u_node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            selectAll(".u_img")
                .attr('x', d => d.x)
                .attr('y', d => d.y);

            selectAll(".user_info")
                .attr('x', d => d.x - (div_width / 2) / current_zoom)
                .attr('y', d => d.y - (div_height / current_zoom) - (user_radius / 2) / current_zoom);

            selectAll(".sliderDiv")
                .attr('x', d => d.x - (slider_width / 2) / current_zoom)
                .attr('y', d => d.y + (user_radius / 2) / current_zoom);

            text
                .attr("x", d => d.x)
                .attr("y", d => (d.weight ? d.y + getRadius(d.weight) / 8 : d.y));

            // linkNode.attr("cx", function (d) { return d.x = (d.source.x + d.target.x) * 0.5; })
            //     .attr("cy", function (d) { return d.y = (d.source.y + d.target.y) * 0.5; });
        }

        /* Given a genre weight, returns its correspondent node size */
        function getRadius(weight) {
            const max = users_length * 10;
            const min = 40;
            const mult = weight * 10;

            if (mult < min) return min;
            if (mult > max) return max;
            else return mult;
        }

        function dragstarted(d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

    }

    render() {
        return (
            <div>
                <svg ref={node => this.node = node} width={this.props.width} height={this.props.height}></svg>
            </div>
        )
    }
}
export default Graph