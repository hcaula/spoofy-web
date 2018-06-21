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

class Graph extends Component {

    constructor(props) {
        super(props);

        /* Logged user */
        this.user = this.props.user;

        /* All the users in our system */
        this.users = this.props.users;

        /* The minimum weight to which have a link between an user and a genre */
        this.default_weight = 3;
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

        /* Call familiar D3 function */
        this.drawGraph();
    }

    drawGraph() {
        const svg = select('svg');
        const width = +svg.attr("width");
        const height = +svg.attr("height");
        const graph = svg.append('g');

        /* Size of the user circle radius */
        const user_radius = 100;

        /* Initial scale for zoom */
        const initial_zoom = 0.4;

        const ex_top = extent(everynoise1.genres.map(n => n.top));
        const ex_left = extent(everynoise1.genres.map(n => n.left));

        const green_scale = scaleLinear()
            .domain([ex_top[0], ex_top[1]])
            .range([0, 255]);

        const blue_scale = scaleLinear()
            .domain([ex_left[0], ex_left[1]])
            .range([0, 255]);

        /* Physics simualations properties */
        const simulation = forceSimulation()
            .force('link', forceLink().id(d => d.id).distance(200))
            .force('charge', forceManyBody())
            .force('center', forceCenter(width / 2, height / 2))
            .force('collision', forceCollide().radius(d => 200))

        /* Calls 'ticked' function every subsecond */
        simulation
            .nodes(this.nodes)
            .on("tick", ticked)

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
                const red = 125;
                const green = green_scale(everynoise2[g.name].top);
                const blue = blue_scale(everynoise2[g.name].left);
                return `rgb(${red},${green},${blue})`;
            })
            .attr("class", 'genre')
            .attr("id", g => `node_${g.id}`)
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
            .append('xhtml:img')
            .attr("height", "100%")
            .attr("width", "100%")
            .attr('src', u => u.image)
            .attr("id", g => `node_${g.id}`)
            .attr("style", u => {
                let style = "border-radius: 100%;";
                if (u.id === this.user._id) style += "border: 5px solid red;"
                return style;
            })
            .call(drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))

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
                graph.attr('transform', event.transform)

                /* Forces users' nodes to remain a constant size */
                selectAll('.u_img')
                    .attr('height', () => user_radius / event.transform.k)
                    .attr('width', () => user_radius / event.transform.k)

                /* Translates images after zoom */
                const val = user_radius / event.transform.k / 2;
                selectAll('foreignObject')
                    .attr("transform",
                        `translate(-${val},-${val})`);

                selectAll('.genre')
                    .attr('style', d => {
                        const ratio = d.weight / 4;
                        return `opacity: ${event.transform.k * ratio}`
                    });

                selectAll('.link')
                    .attr('style', d => {
                        const ratio = d.weight / 4;
                        return `opacity: ${event.transform.k * ratio}`
                    });

                selectAll('.txt')
                    .attr('style', d => {
                        const ratio = d.weight / 4;
                        return `opacity: ${event.transform.k * ratio}`
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
                .attr("x1", function (d) { return d.source.x; })
                .attr("y1", function (d) { return d.source.y; })
                .attr("x2", function (d) { return d.target.x; })
                .attr("y2", function (d) { return d.target.y; });

            g_node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            u_node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            selectAll(".u_img")
                .attr('x', d => d.x)
                .attr('y', d => d.y);

            text
                .attr("x", d => d.x)
                .attr("y", d => (d.weight ? d.y + getRadius(d.weight) / 8 : d.y));
        }

        /* Given a genre weight, returns its correspondent node size */
        function getRadius(weight) {
            const max = 100;
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
            <svg ref={node => this.node = node} width={this.props.width} height={this.props.height}></svg>
        )
    }
}
export default Graph