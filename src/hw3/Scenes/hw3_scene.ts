import PlayerController from "../AI/PlayerController";
import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import AnimatedSprite from "../../Wolfie2D/Nodes/Sprites/AnimatedSprite";
import Scene from "../../Wolfie2D/Scene/Scene";
import { GraphicType } from "../../Wolfie2D/Nodes/Graphics/GraphicTypes";
import OrthogonalTilemap from "../../Wolfie2D/Nodes/Tilemaps/OrthogonalTilemap";
import PositionGraph from "../../Wolfie2D/DataTypes/Graphs/PositionGraph";
import Navmesh from "../../Wolfie2D/Pathfinding/Navmesh";
import {hw3_Events, hw3_Names} from "../hw3_constants";
import EnemyAI from "../AI/EnemyAI";
import WeaponType from "../GameSystems/items/WeaponTypes/WeaponType";
import RegistryManager from "../../Wolfie2D/Registry/RegistryManager";
import Weapon from "../GameSystems/items/Weapon";
import Healthpack from "../GameSystems/items/Healthpack";
import InventoryManager from "../GameSystems/InventoryManager";
import Item from "../GameSystems/items/Item";
import AABB from "../../Wolfie2D/DataTypes/Shapes/AABB";
import BattleManager from "../GameSystems/BattleManager";
import BattlerAI from "../AI/BattlerAI";
import Label from "../../Wolfie2D/Nodes/UIElements/Label";
import { UIElementType } from "../../Wolfie2D/Nodes/UIElements/UIElementTypes";
import Color from "../../Wolfie2D/Utils/Color";
import Input from "../../Wolfie2D/Input/Input";
import GameOver from "./GameOver";
import AttackAction from "../AI/EnemyActions/AttackAction";
import Move from "../AI/EnemyActions/Move";
import Retreat from "../AI/EnemyActions/Retreat";
import { TweenableProperties } from "../../Wolfie2D/Nodes/GameNode";
import Line from "../../Wolfie2D/Nodes/Graphics/Line";
import { EaseFunctionType } from "../../Wolfie2D/Utils/EaseFunctions";


export default class hw3_scene extends Scene {
    // The player
    private player: AnimatedSprite;

    private playerCharacters: Array<AnimatedSprite>;

    // A list of enemies
    private enemies: Array<AnimatedSprite>;

    // The wall layer of the tilemap to use for bullet visualization
    private walls: OrthogonalTilemap;

    // The position graph for the navmesh
    private graph: PositionGraph;

    // A list of items in the scene
    private items: Array<Item>;

    // The battle manager for the scene
    private battleManager: BattleManager;

    // Player health
    private healthDisplays: Array<Label>;

    loadScene(){
        // Load the player and enemy spritesheets
        this.load.spritesheet("player", "hw3_assets/spritesheets/player.json");
        this.load.spritesheet("enemy", "hw3_assets/spritesheets/enemy.json");
        this.load.spritesheet("slice", "hw3_assets/spritesheets/slice.json");

        // Load the tilemap
        // HOMEWORK 3 - TODO
        // Change this file to be your own tilemap
        //this.load.tilemap("level", "hw3_assets/tilemaps/TopDown_hw3.json");
        this.load.tilemap("level", "hw3_assets/tilemaps/cse380_hw3_tilejson.json");

        // Load the scene info
        this.load.object("weaponData", "hw3_assets/data/weaponData.json");

        // Load the nav mesh
        this.load.object("navmesh", "hw3_assets/data/newNavmesh.json");

        // Load in the enemy info
        this.load.object("enemyData", "hw3_assets/data/enemy.json");

        // Load in item info
        this.load.object("itemData", "hw3_assets/data/items.json");

        // Load the healthpack sprite
        this.load.image("healthpack", "hw3_assets/sprites/healthpack.png");
        this.load.image("inventorySlot", "hw3_assets/sprites/inventory.png");
        this.load.image("knife", "hw3_assets/sprites/knife.png");
        this.load.image("laserGun", "hw3_assets/sprites/laserGun.png");
        this.load.image("pistol", "hw3_assets/sprites/pistol.png");
        
    }

    startScene(){
        // Add in the tilemap
        let tilemapLayers = this.add.tilemap("level");

        // Get the wall layer
        // HOMEWORK 3 - TODO
        /*
            Modify this line if needed.
            
            This line is just getting the wall layer of your tilemap to use for some calculations.
            Make sure it is still doing so.

            What the line is saying is to get the first level from the bottom (tilemapLayers[1]),
            which in my case was the Walls layer.
        */
        this.walls = <OrthogonalTilemap>tilemapLayers[1].getItems()[0];

        // Set the viewport bounds to the tilemap
        let tilemapSize: Vec2 = this.walls.size; 
        this.viewport.setBounds(0, 0, tilemapSize.x, tilemapSize.y);

        this.addLayer("primary", 10);

        // Create the battle manager
        this.battleManager = new BattleManager();

        this.initializeWeapons();

        // Initialize the items array - this represents items that are in the game world
        this.items = new Array();

        // Create the player
        this.initializePlayer();

        // Make the viewport follow the player
        this.viewport.follow(this.player);

        // Zoom in to a reasonable level
        this.viewport.enableZoom();
        this.viewport.setZoomLevel(4);

        // Create the navmesh
        this.createNavmesh();

        // Initialize all enemies
        this.initializeEnemies();

        // Send the player and enemies to the battle manager
        this.battleManager.setPlayers([<BattlerAI>this.playerCharacters[0]._ai, <BattlerAI>this.playerCharacters[1]._ai]);
        this.battleManager.setEnemies(this.enemies.map(enemy => <BattlerAI>enemy._ai));

        // Subscribe to relevant events
        this.receiver.subscribe("healthpack");
        this.receiver.subscribe("enemyDied");
        this.receiver.subscribe(hw3_Events.UNLOAD_ASSET);

        // Spawn items into the world
        this.spawnItems();

        // Add a UI for health
        this.addUILayer("health");

        this.healthDisplays = new Array(2);
        this.healthDisplays[0] = <Label>this.add.uiElement(UIElementType.LABEL, "health", {position: new Vec2(70, 16), text: "Health: " + (<BattlerAI>this.playerCharacters[0]._ai).health});
        this.healthDisplays[0].textColor = Color.WHITE;

        this.healthDisplays[1] = <Label>this.add.uiElement(UIElementType.LABEL, "health", {position: new Vec2(70, 32), text: "Health: " + (<BattlerAI>this.playerCharacters[1]._ai).health});
        this.healthDisplays[1].textColor = Color.WHITE;
    }

    updateScene(deltaT: number): void {
        while(this.receiver.hasNextEvent()){
            let event = this.receiver.getNextEvent();

            if(event.isType("healthpack")){
                this.createHealthpack(event.data.get("position"));
            }
            if(event.isType("enemyDied")){
                this.enemies = this.enemies.filter(enemy => enemy !== event.data.get("enemy"));
                this.battleManager.enemies = this.battleManager.enemies.filter(enemy => enemy !== <BattlerAI>(event.data.get("enemy")._ai));
            }
            if(event.isType(hw3_Events.UNLOAD_ASSET)){
                console.log(event.data);
                let asset = this.sceneGraph.getNode(event.data.get("node"));

                asset.destroy();
            }
        }

        // update health of each player
        let health1 = (<BattlerAI>this.playerCharacters[0]._ai).health;
        let health2 = (<BattlerAI>this.playerCharacters[1]._ai).health;

        if(health1 === 0 || health2 === 0){
            this.sceneManager.changeToScene(GameOver);
        }

        // update closest enemy of each player
        let closetEnemy1 = this.getClosestEnemy(this.playerCharacters[0].position, (<PlayerController>this.playerCharacters[0]._ai).range);
        let closetEnemy2 = this.getClosestEnemy(this.playerCharacters[1].position, (<PlayerController>this.playerCharacters[1]._ai).range);

        (<PlayerController>this.playerCharacters[0]._ai).target = closetEnemy1;
        (<PlayerController>this.playerCharacters[1]._ai).target = closetEnemy2;

        // Update health gui
        this.healthDisplays[0].text = "Health: " + health1;
        this.healthDisplays[1].text = "Health: " + health2;

        // Debug mode graph
        if(Input.isKeyJustPressed("g")){
            this.getLayer("graph").setHidden(!this.getLayer("graph").isHidden());
        }
        
        //Swap characters
        if(Input.isKeyJustPressed("z")){
            (<PlayerController>this.playerCharacters[0]._ai).inputEnabled = true;
            (<PlayerController>this.playerCharacters[1]._ai).inputEnabled = false;
            (<PlayerController>this.playerCharacters[0]._ai).inventory.setActive(true);
            (<PlayerController>this.playerCharacters[1]._ai).inventory.setActive(false);
            this.player = this.playerCharacters[0];
            this.viewport.follow(this.player);
            //health = (<BattlerAI>this.player._ai).health;
        }

        if(Input.isKeyJustPressed("x")){
            (<PlayerController>this.playerCharacters[1]._ai).inputEnabled = true;
            (<PlayerController>this.playerCharacters[0]._ai).inputEnabled = false;
            (<PlayerController>this.playerCharacters[1]._ai).inventory.setActive(true);
            (<PlayerController>this.playerCharacters[0]._ai).inventory.setActive(false);
            this.player = this.playerCharacters[1];
            this.viewport.follow(this.player);
            //health = (<BattlerAI>this.player._ai).health;
        }
    }

    getClosestEnemy(playerPos: Vec2, range: number): Vec2 {
        let closetDistance: number = Number.POSITIVE_INFINITY;
        let closetEnemy: Vec2 = null;
        for (let enemy of this.enemies){
            let distance = Math.sqrt(Math.pow(enemy.position.x - playerPos.x, 2) + Math.pow(enemy.position.y - playerPos.y, 2));
            if (distance <= range){
                console.log("Closet enemeny " + distance)
                if (distance < closetDistance){
                    closetDistance = distance;
                    closetEnemy = enemy.position;
                    console.log("Closet enemeny" + closetEnemy.toString())
                }
            }
        }
        return closetEnemy;
    }

    // HOMEWORK 3 - TODO
    /**
     * This function spawns in all of the items in "items.json"
     * 
     * You shouldn't have to put any new code here, however, you will have to modify items.json.
     * 
     * Make sure you are spawning in 5 pistols and 5 laser guns somewhere (accessible) in your world.
     * 
     * You'll notice that right now, some healthpacks are also spawning in. These also drop from guards.
     * Feel free to spawn some healthpacks if you want, or you can just let the player suffer >:)
     */
    spawnItems(): void {
        // Get the item data
        let itemData = this.load.getObject("itemData");

        for(let item of itemData.items){
            if(item.type === "healthpack"){
                // Create a healthpack
                this.createHealthpack(new Vec2(item.position[0], item.position[1]));
            } else {
                let weapon = this.createWeapon(item.weaponType);
                weapon.moveSprite(new Vec2(item.position[0], item.position[1]));
                this.items.push(weapon);
            }
        }        
    }

    /**
     * 
     * Creates and returns a new weapon
     * @param type The weaponType of the weapon, as a string
     */
    createWeapon(type: string): Weapon {
        let weaponType = <WeaponType>RegistryManager.getRegistry("weaponTypes").get(type);

        let sprite = this.add.sprite(weaponType.spriteKey, "primary");

        return new Weapon(sprite, weaponType, this.battleManager);
    }

    /**
     * Creates a healthpack at a certain position in the world
     * @param position 
     */
    createHealthpack(position: Vec2): void {
        let sprite = this.add.sprite("healthpack", "primary");
        let healthpack = new Healthpack(sprite)
        healthpack.moveSprite(position);
        this.items.push(healthpack);
    }

    // HOMEWORK 3 - TODO
    /**
     * You'll want to have a new weapon type available in your program - a laser gun.
     * Carefully look through the code for how the other weapon types (knife and pistol)
     * are created. They're based of the templates Slice and SemiAutoGun. You should use
     * the SemiAutoGun template for your laser gun.
     * 
     * The laser gun should have a green beam, and should be considerably more powerful than
     * a pistol. You can decide just how powerful it is.
     * 
     * Look in weaponData.json for some insight on what to do here.
     * 
     * Loads in all weapons from file
     */
    initializeWeapons(): void{
        let weaponData = this.load.getObject("weaponData");

        for(let i = 0; i < weaponData.numWeapons; i++){
            let weapon = weaponData.weapons[i];

            // Get the constructor of the prototype
            let constr = RegistryManager.getRegistry("weaponTemplates").get(weapon.weaponType);

            // Create a weapon type
            let weaponType = new constr();

            // Initialize the weapon type
            weaponType.initialize(weapon);

            // Register the weapon type
            RegistryManager.getRegistry("weaponTypes").registerItem(weapon.name, weaponType)
        }
    }

    initializePlayer(): void {
        // Create the inventory
        let inventory = new InventoryManager(this, 2, "inventorySlot", new Vec2(16, 16), 4, "slots1", "items1");
        let startingWeapon = this.createWeapon("knife");
        inventory.addItem(startingWeapon);

        // Create the players
        this.playerCharacters = Array(2);
        this.playerCharacters[0] = this.add.animatedSprite("player", "primary");
        this.playerCharacters[0].position.set(4*16, 62*16);
        this.playerCharacters[0].addPhysics(new AABB(Vec2.ZERO, new Vec2(5, 5)));
        this.playerCharacters[0].addAI(PlayerController,
            {
                speed: 100,
                inventory: inventory,
                items: this.items,
                inputEnabled: true,
                range: 30
            });
        this.playerCharacters[0].animation.play("IDLE");

        ///////////

        inventory = new InventoryManager(this, 2, "inventorySlot", new Vec2(16, 32), 4, "slots2", "items2");
        startingWeapon = this.createWeapon("weak_pistol");
        inventory.addItem(startingWeapon);

        this.playerCharacters[1] = this.add.animatedSprite("player", "primary");
        this.playerCharacters[1].position.set(2*16, 62*16);
        this.playerCharacters[1].addPhysics(new AABB(Vec2.ZERO, new Vec2(5, 5)));
        this.playerCharacters[1].addAI(PlayerController,
            {
                speed: 100,
                inventory: inventory,
                items: this.items,
                inputEnabled: false,
                range: 100
            });
        this.playerCharacters[1].animation.play("IDLE");

        this.player = this.playerCharacters[0];
        (<PlayerController>this.playerCharacters[0]._ai).inventory.setActive(true);
        (<PlayerController>this.playerCharacters[1]._ai).inventory.setActive(false);
    }

    // HOMEWORK 3 - TODO
    /**
     * This function creates the navmesh for the game world.
     * 
     * It reads in information in the navmesh.json file.
     * The format of the navmesh.json file is as follows
     * 
     * {
     *  // An array of positions on the tilemap. You can see the position of your mouse in [row, col]
     *  // while editing a map in Tiled, and can just multiply those values by the tile size, 16x16
     *      "nodes": [[100, 200], [50, 400], ...]
     * 
     *  // An array of edges between nodes. The numbers here correspond to indices in the "nodes" array above.
     *  // Note that edges are not directed here. An edge [0, 1] foes in both directions.
     *      "edges": [[0, 1], [2, 4], ...]
     * }
     * 
     * Your job here is to make a new graph to serve as the navmesh. Your graph should be designed
     * for your tilemap, and no edges should go through walls.
     */
    createNavmesh(): void {
        // Add a layer to display the graph
        let gLayer = this.addLayer("graph");
        gLayer.setHidden(true);

        let navmeshData = this.load.getObject("navmesh");

         // Create the graph
        this.graph = new PositionGraph();

        // Add all nodes to our graph
        for(let node of navmeshData.nodes){
            this.graph.addPositionedNode(new Vec2(node[0], node[1]));
            this.add.graphic(GraphicType.POINT, "graph", {position: new Vec2(node[0], node[1])})
        }

        // Add all edges to our graph
        for(let edge of navmeshData.edges){
            this.graph.addEdge(edge[0], edge[1]);
            this.add.graphic(GraphicType.LINE, "graph", {start: this.graph.getNodePosition(edge[0]), end: this.graph.getNodePosition(edge[1])})
        }

        // Set this graph as a navigable entity
        console.log(this.graph.toString());
        console.log(navmeshData.nodes.length);

        let navmesh = new Navmesh(this.graph);

        this.navManager.addNavigableEntity(hw3_Names.NAVMESH, navmesh);
    }

    // HOMEWORK 3 - TODO
    /**
     * This function creates all enemies from the enemy.json file.
     * You shouldn't have to modify any code here, but you should edit enemy.json to
     * make sure more enemies are spawned into the world.
     * 
     * Patrolling enemies are given patrol routes corresponding to the navmesh. The numbers in their route correspond
     * to indices in the navmesh.
     */
    initializeEnemies(){
        // Get the enemy data
        const enemyData = this.load.getObject("enemyData");

        // Create an enemies array
        this.enemies = new Array(enemyData.numEnemies);

        // Initialize the enemies
        for(let i = 0; i < enemyData.numEnemies; i++){
            let data = enemyData.enemies[i];

            // Create an enemy
            this.enemies[i] = this.add.animatedSprite("enemy", "primary");
            this.enemies[i].position.set(data.position[0], data.position[1]);
            this.enemies[i].animation.play("IDLE");

            // Activate physics
            this.enemies[i].addPhysics(new AABB(Vec2.ZERO, new Vec2(5, 5)));

            if(data.route){
                data.route = data.route.map((index: number) => this.graph.getNodePosition(index));                
            }

            if(data.guardPosition){
                data.guardPosition = new Vec2(data.guardPosition[0], data.guardPosition[1]);
            }
            //initalize status and actions for each enemy
            let statusArray: Array<string> = [];
            
            // Attack action
            let action1 = new AttackAction(3, ["IN_RANGE"], ["GOAL"]);

            //Vary move action cost
            let action2: Move;
            let range: number;
            if (i % 2 === 0){
                range = 100;
                action2 = new Move(2, [], ["IN_RANGE"], {inRange: range});
            }
            else {
                range = 20;
                action2 = new Move(2, [], ["IN_RANGE"], {inRange: range});
            }

            //Vary retreat action cost
            let action3: Retreat;
            if (i % 2 === 0){
                action3 = new Retreat(1, ["LOW_HEALTH"], ["GOAL"]);
            }
            else {
                action3 = new Retreat(4, ["LOW_HEALTH"], ["GOAL"]);
            }

            //Vary weapon type
            let wep;
            if (i % 2 === 0){
                wep = this.createWeapon("weak_pistol")
            }
            else {
                wep = this.createWeapon("knife")
            }
            

            let enemyOptions = {
                defaultMode: data.mode,
                patrolRoute: data.route,            // This only matters if they're a patroller
                guardPosition: data.guardPosition,  // This only matters if the're a guard
                health: data.health,
                player1: this.playerCharacters[0],
                player2: this.playerCharacters[1],
                weapon: wep,
                goal: "GOAL",
                status: statusArray,
                actions: [action1, action2, action3],
                inRange: range
            }

            this.enemies[i].addAI(EnemyAI, enemyOptions);
        }
    }
}