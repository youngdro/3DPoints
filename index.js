class ThreeDWorld {
    constructor(canvasContainer) {
        // canvas容器
        this.container = canvasContainer || document.body;
        // 创建场景
        this.createScene();
        // 创建灯光
        this.createLights();
        // 性能监控插件
        this.initStats();
        // 鼠标交互事件监听
        this.addMouseListener();
        // 物体添加
        this.addObjs();
        // 轨道控制插件（鼠标拖拽视角、缩放等）
        this.orbitControls = new THREE.OrbitControls(this.camera);
        this.orbitControls.autoRotate = true;
        // 循环更新场景
        this.update();
    }
    createScene() {
        this.HEIGHT = window.innerHeight;
        this.WIDTH = window.innerWidth;
        // 创建场景
        this.scene = new THREE.Scene();
        // 在场景中添加雾的效果，参数分别代表‘雾的颜色’、‘开始雾化的视线距离’、刚好雾化至看不见的视线距离’
        this.scene.fog = new THREE.Fog(0x090918, 1, 600);
        // 创建相机
        let aspectRatio = this.WIDTH / this.HEIGHT;
        let fieldOfView = 60;
        let nearPlane = 1;
        let farPlane = 10000;
        /**
         * PerspectiveCamera 透视相机
         * @param fieldOfView 视角
         * @param aspectRatio 纵横比
         * @param nearPlane 近平面
         * @param farPlane 远平面
         */
        this.camera = new THREE.PerspectiveCamera(
            fieldOfView,
            aspectRatio,
            nearPlane,
            farPlane
        );

        // 设置相机的位置
        this.camera.position.x = 0;
        this.camera.position.z = 150;
        this.camera.position.y = 0;
        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({
            // 在 css 中设置背景色透明显示渐变色
            alpha: true,
            // 开启抗锯齿
            antialias: true
        });
        // 渲染背景颜色同雾化的颜色
        this.renderer.setClearColor(this.scene.fog.color);
        // 定义渲染器的尺寸；在这里它会填满整个屏幕
        this.renderer.setSize(this.WIDTH, this.HEIGHT);

        // 打开渲染器的阴影地图
        this.renderer.shadowMap.enabled = true;
        // this.renderer.shadowMapSoft = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        // 在 HTML 创建的容器中添加渲染器的 DOM 元素
        this.container.appendChild(this.renderer.domElement);
        // 监听屏幕，缩放屏幕更新相机和渲染器的尺寸
        window.addEventListener('resize', this.handleWindowResize.bind(this), false);
    }
    createLights() {
        // 户外光源
        // 第一个参数是天空的颜色，第二个参数是地上的颜色，第三个参数是光源的强度
        this.hemisphereLight = new THREE.HemisphereLight(0xaaaaaa, 0x000000, .9);

        // 环境光源
        this.ambientLight = new THREE.AmbientLight(0xdc8874, .2);

        // 方向光是从一个特定的方向的照射
        // 类似太阳，即所有光源是平行的
        // 第一个参数是关系颜色，第二个参数是光源强度
        this.shadowLight = new THREE.DirectionalLight(0xffffff, .9);

        // 设置光源的方向。
        this.shadowLight.position.set(50, 50, 50);

        // 开启光源投影
        this.shadowLight.castShadow = true;

        // 定义可见域的投射阴影
        this.shadowLight.shadow.camera.left = -400;
        this.shadowLight.shadow.camera.right = 400;
        this.shadowLight.shadow.camera.top = 400;
        this.shadowLight.shadow.camera.bottom = -400;
        this.shadowLight.shadow.camera.near = 1;
        this.shadowLight.shadow.camera.far = 1000;

        // 定义阴影的分辨率；虽然分辨率越高越好，但是需要付出更加昂贵的代价维持高性能的表现。
        this.shadowLight.shadow.mapSize.width = 2048;
        this.shadowLight.shadow.mapSize.height = 2048;

        // 为了使这些光源呈现效果，只需要将它们添加到场景中
        this.scene.add(this.hemisphereLight);
        this.scene.add(this.shadowLight);
        this.scene.add(this.ambientLight);
    }
    initStats() {
        this.stats = new Stats();
        // 将性能监控屏区显示在左上角
        this.stats.domElement.style.position = 'absolute';
        this.stats.domElement.style.bottom = '0px';
        this.stats.domElement.style.zIndex = 100;
        this.container.appendChild(this.stats.domElement);
    }
    handleWindowResize() {
        // 更新渲染器的高度和宽度以及相机的纵横比
        this.HEIGHT = window.innerHeight;
        this.WIDTH = window.innerWidth;
        this.renderer.setSize(this.WIDTH, this.HEIGHT);
        this.camera.aspect = this.WIDTH / this.HEIGHT;
        this.camera.updateProjectionMatrix();
    }
    addMouseListener() {
        // 层层往上寻找模型的父级，直至它是场景下的直接子元素
        function parentUtilScene(obj) {
            if (obj.parent.type === 'Scene') return obj;
            while (obj.parent && obj.parent.type !== 'Scene') {
                obj = obj.parent;
            }
            return obj;
        }
        // canvas容器内鼠标点击事件添加
        this.container.addEventListener("mousedown", (event) => {
            this.handleRaycasters(event, (objTarget) => {
                // 寻找其对应父级为场景下的直接子元素
                let object = parentUtilScene(objTarget);
                // 调用拾取到的物体的点击事件
                object._click && object._click();
                // 遍历场景中除当前拾取外的其他物体，执行其未被点击到的事件回调
                this.scene.children.forEach((objItem) => {
                    if (objItem !== object) {
                        objItem._clickBack && objItem._clickBack();
                    }
                });
            });
        });
        // canvas容器内鼠标移动事件添加
        this.container.addEventListener("mousemove", (event) => {
            this.handleRaycasters(event, (objTarget) => {
                // 寻找其对应父级为场景下的直接子元素
                let object = parentUtilScene(objTarget);
                // 鼠标移动到拾取物体上且未离开时时，仅调用一次其悬浮事件方法
                !object._hover_enter && object._hover && object._hover();
                object._hover_enter = true;
                // 遍历场景中除当前拾取外的其他物体，执行其未有鼠标悬浮的事件回调
                this.scene.children.forEach((objItem) => {
                    if (objItem !== object) {
                        objItem._hover_enter && objItem._hoverBack && objItem._hoverBack();
                        objItem._hover_enter = false;
                    }
                });
            })
        });
        // 为所有3D物体添加上“on”方法，可监听物体的“click”、“hover”事件
        THREE.Object3D.prototype.on = function(eventName, touchCallback, notTouchCallback) {
            switch (eventName) {
                case "click":
                    this._click = touchCallback ? touchCallback : undefined;
                    this._clickBack = notTouchCallback ? notTouchCallback : undefined;
                    break;
                case "hover":
                    this._hover = touchCallback ? touchCallback : undefined;
                    this._hoverBack = notTouchCallback ? notTouchCallback : undefined;
                    break;
                default:
                    ;
            }
        }
    }
    // 射线处理
    handleRaycasters(event, callback) {
        let mouse = new THREE.Vector2();
        let raycaster = new THREE.Raycaster();
        mouse.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, this.camera);
        let intersects = raycaster.intersectObjects(this.scene.children, true)
        if (intersects.length > 0) {
            callback && callback(intersects[0].object);
        }
    }
    // 阴影添加
    onShadow(obj) {
        if (obj.type === 'Mesh') {
            obj.castShadow = true;
            obj.receiveShadow = true;
        }
        if (obj.children && obj.children.length > 0) {
            obj.children.forEach((item) => {
                this.onShadow(item);
            })
        }
        return;
    }
    // 自定义模型加载
    loader(pathArr) {
        let jsonLoader = new THREE.JSONLoader();
        let fbxLoader = new THREE.FBXLoader();
        let mtlLoader = new THREE.MTLLoader();
        let objLoader = new THREE.OBJLoader();
        let basePath, pathName, pathFomat;
        let promiseArr = pathArr.map((path) => {
            basePath = path.substring(0, path.lastIndexOf('/') + 1);
            pathName = path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'));
            // 后缀为js或json的文件统一当做js格式处理
            pathName = pathName === 'json' ? 'js' : pathName;
            pathFomat = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
            switch (pathFomat) {
                case 'js':
                    return new Promise(function(resolve) {
                        jsonLoader.load(path, (geometry, material) => {
                            resolve({
                                geometry: geometry,
                                material: material
                            })
                        });
                    });
                    break;
                case 'fbx':
                    return new Promise(function(resolve) {
                        fbxLoader.load(path, (object) => {
                            resolve(object);
                        });
                    });
                    break;
                case 'obj':
                    return new Promise(function(resolve) {
                        objLoader.load(path, (object) => {
                            resolve(object);
                        });
                    });
                    break;
                case 'mtl':
                    return new Promise(function(resolve) {
                        mtlLoader.setBaseUrl(basePath);
                        mtlLoader.setPath(basePath);
                        mtlLoader.load(pathName + '.mtl', (mtl) => {
                            resolve(mtl);
                        });
                    });
                    break;
                case 'objmtl':
                    return new Promise(function(resolve, reject) {
                        mtlLoader.setBaseUrl(basePath);
                        mtlLoader.setPath(basePath);
                        mtlLoader.load(`${pathName}.mtl`, (mtl) => {
                            mtl.preload();
                            objLoader.setMaterials(mtl);
                            objLoader.setPath(basePath);
                            objLoader.load(pathName + '.obj', resolve, undefined, reject);
                        });
                    });
                    break;
                default:
                    return '';
            }
        });
        return Promise.all(promiseArr);
    }
    // 模型加入场景
    addObjs() {
        this.loader(['obj/robot.fbx', 'obj/Guitar/Guitar.fbx']).then((result) => {
            let robot = result[0].children[1].geometry;
            let guitarObj = result[1].children[0].geometry;
            guitarObj.scale(1.5, 1.5, 1.5);
            guitarObj.rotateX(-Math.PI / 2);
            robot.scale(0.08, 0.08, 0.08);
            robot.rotateX(-Math.PI / 2);
            this.addPartices(robot, guitarObj);
        });
    }
    // 几何模型转缓存几何模型
    toBufferGeometry(geometry) {
        if (geometry.type === 'BufferGeometry') return geometry;
        return new THREE.BufferGeometry().fromGeometry(geometry);
    }
    // 粒子变换
    addPartices(obj1, obj2) {
        obj1 = this.toBufferGeometry(obj1);
        obj2 = this.toBufferGeometry(obj2);
        let moreObj = obj1
        let lessObj = obj2;
        // 找到顶点数量较多的模型
        if (obj2.attributes.position.array.length > obj1.attributes.position.array.length) {
            [moreObj, lessObj] = [lessObj, moreObj];
        }
        let morePos = moreObj.attributes.position.array;
        let lessPos = lessObj.attributes.position.array;
        let moreLen = morePos.length;
        let lessLen = lessPos.length;
        // 根据最大的顶点数开辟数组空间，同于存放顶点较少的模型顶点数据
        let position2 = new Float32Array(moreLen);
        // 先把顶点较少的模型顶点坐标放进数组
        position2.set(lessPos);
        // 剩余空间重复赋值
        for (let i = lessLen, j = 0; i < moreLen; i++, j++) {
            j %= lessLen;
            position2[i] = lessPos[j];
            position2[i + 1] = lessPos[j + 1];
            position2[i + 2] = lessPos[j + 2];
        }
        // sizes用来控制每个顶点的尺寸，初始为4
        let sizes = new Float32Array(moreLen);
        for (let i = 0; i < moreLen; i++) {
            sizes[i] = 4;
        }
        // 挂载属性值
        moreObj.addAttribute('size', new THREE.BufferAttribute(sizes, 1));
        moreObj.addAttribute('position2', new THREE.BufferAttribute(position2, 3));
        // 传递给shader共享的的属性值
        let uniforms = {
            // 顶点颜色
            color: {
                type: 'v3',
                value: new THREE.Color(0xffffff)
            },
            // 传递顶点贴图
            texture: {
                value: this.getTexture(64)
            },
            // 传递val值，用于shader计算顶点位置
            val: {
                value: 1.0
            }
        };
        // 着色器材料
        let shaderMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: document.getElementById('vertexshader').textContent,
            fragmentShader: document.getElementById('fragmentshader').textContent,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true
        });
        // 创建粒子系统
        let particleSystem = new THREE.Points(moreObj, shaderMaterial);
        let pos = {
            val: 1
        };
        // 粒子动画
        let tween = new TWEEN.Tween(pos).to({
            val: 0
        }, 1500).easing(TWEEN.Easing.Quadratic.InOut).delay(2000).onUpdate(updateCallback).onComplete(completeCallBack.bind(pos, 'go'));
        let tweenBack = new TWEEN.Tween(pos).to({
            val: 1
        }, 1500).easing(TWEEN.Easing.Quadratic.InOut).delay(2000).onUpdate(updateCallback).onComplete(completeCallBack.bind(pos, 'back'));
        tween.chain(tweenBack);
        tweenBack.chain(tween);
        tween.start();
        // 动画持续更新的回调函数
        function updateCallback() {
            particleSystem.material.uniforms.val.value = this.val;
            // 颜色过渡
            if (this.nextcolor) {
                let val = this.order === 'back' ? (1 - this.val) : this.val;
                let uColor = particleSystem.material.uniforms.color.value;
                uColor.r = this.color.r + (this.nextcolor.r - this.color.r) * val;
                uColor.b = this.color.b + (this.nextcolor.b - this.color.b) * val;
                uColor.g = this.color.g + (this.nextcolor.g - this.color.g) * val;
            }
        }
        // 每轮动画完成时的回调函数
        function completeCallBack(order) {
            let uColor = particleSystem.material.uniforms.color.value;
            // 保存动画顺序状态
            this.order = order;
            // 保存旧的粒子颜色
            this.color = {
                r: uColor.r,
                b: uColor.b,
                g: uColor.g
            }
            // 随机生成将要变换后的粒子颜色
            this.nextcolor = {
                r: Math.random(),
                b: Math.random(),
                g: Math.random()
            }
        }
        this.scene.add(particleSystem);
        this.particleSystem = particleSystem;
    }
    getTexture(canvasSize = 64) {
        let canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        canvas.style.background = "transparent";
        let context = canvas.getContext('2d');
        let gradient = context.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width / 8, canvas.width / 2, canvas.height / 2, canvas.width / 2);
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(1, 'transparent');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2, true);
        context.fill();
        let texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
    update() {
        TWEEN.update();
        this.stats.update();
        let time = Date.now() * 0.005;
        if (this.particleSystem) {
            let bufferObj = this.particleSystem.geometry;
            this.particleSystem.rotation.y = 0.01 * time;
            let sizes = bufferObj.attributes.size.array;
            let len = sizes.length;
            for (let i = 0; i < len; i++) {
                sizes[i] = 1.5 * (2.0 + Math.sin(0.02 * i + time));

            }
            bufferObj.attributes.size.needsUpdate = true;
        }
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => {
            this.update()
        });
    }
}

function onLoad() {
    new ThreeDWorld(document.getElementById("world"));
}