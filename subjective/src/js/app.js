App = {
    web3Provider: null,
    contract: null,
    loading: false,
    account: '0x0',
    owner: '0x0',
    index: 0,
    upfront_value: 0,
    web3: null,
    init: function(){
        console.log("App initialized...");
        return App.initWeb3();
    },

    initWeb3: function(){
        if(typeof web3 !== 'undefined'){
            // If a web3 instance is already provided by Meta Mask.
            App.web3Provider = ethereum;
            App.web3 = new Web3(ethereum);
        }else{
            // Specify default instance if no web3 instance provided
            App.web3Provider = new Web3.providers.HttpProvider('http://localhost:8545');
            App.web3 = new Web3(App.web3Provider);
        }
        App.web3 = new Web3(App.web3Provider);
        return App.initSubjective();
    },

    initSubjective: function(){
        $.getJSON("Subjective.json",function(Subjective){
            App.contract = TruffleContract(Subjective);
            App.contract.setProvider(App.web3Provider);
            App.contract.deployed().
            then(function(instance){
                console.log("Subjective Address:",instance.address);
            });
            return App.render();
        })
    },

    render: function(){
        if(App.loading){
            return;
        }
        loading = true;

        var loader = $('#loader');
        var content = $('#content');

        loader.show();
        content.hide();

        App.web3.eth.getCoinbase(function(err,account){
            if(err === null){
                App.account = account;
                console.log("Account:",App.account);
            }
        }).then(function(){
            App.loading = false;
            loader.hide();
            content.show();
        })
    },

    createContract: function(){
        $('#content').hide();
        $('#loader').show();

        App.contract.deployed().then(function(instance){
            var price = parseFloat($('#price').val());
            var not_delivered_penalty = parseFloat($('#not_delivered_penalty').val());
            var quotient = parseInt($('#quotient').val());
            var is_seller = $('.isSeller').val();
            var upfront_value;
            if(is_seller == 'true')
                upfront_value = not_delivered_penalty+price/quotient;
            else
                upfront_value = price+price/quotient;
            
            return instance.createContract(
                $('#secondParty').val(),
                $('.thirdParty').val(),
                is_seller,
                App.web3.utils.toWei(String(price),"finney"),
                App.web3.utils.toWei(String(not_delivered_penalty),"finney"),
                quotient,
                $('#max_evaluation').val(),
                $('#upfront_time').val()*86400,//days to seconds
                $('#evaluation_time').val()*86400,//days to seconds
                $('.payUpfront').val(),
                $('#evaluation-input').val(),
                {
                    from: App.account,
                    value: App.web3.utils.toWei(String(upfront_value),"finney"),
                    gas: 500000
                }
            );
        }).then(function(result){
            $('#loader').hide();
            $('#content').show();   
        });
    },

    getContract: function(){
        App.contract.deployed().then(function(instance){
            App.owner = $('#owner').val();
            App.index = $('#index').val();
            return instance.getContract( 
                App.owner,
                App.index,
                {
                    from: App.account,
                    value: 0,
                    gas: 500000
                }
            );
        }).then(function(result){
            var evaluation = document.getElementById('evaluation');
            evaluation.setAttribute("max", result.max_evaluation);
            evaluation.setAttribute("placeholder", "0 to "+result.max_evaluation);
            
            var price = parseFloat(App.web3.utils.fromWei(result.price,"finney"));
            var not_delivered_penalty = parseFloat(App.web3.utils.fromWei(result.not_delivered_penalty,"finney"));
  
            if(result.is_seller)
                App.upfront_value = not_delivered_penalty+price/result.quotient;
            else
                App.upfront_value = price+price/result.quotient;

            var html_str = "<tr><th style='width: "+100/(result.max_evaluation+2)+"%' scope='col'>Buyer \\ Seller</th>";
            for(var j = 0; j <= result.max_evaluation;j++){
                html_str += "<th style='width: "+100/(result.max_evaluation+2)+"%' scope='col'>"+j+"</th>";
            }
            html_str += '</tr>';      
                
            for(var i = 0;i <= result.max_evaluation;i++){

                html_str += "<tr><th scope='row'>"+i+"</th>";
                for(var j = 0; j <= result.max_evaluation;j++){
                    
                    if(i >= j){
                        var amount = (price+not_delivered_penalty)*(i+j)/result.max_evaluation/2;
                        var buyer_value = Math.round((-amount+not_delivered_penalty)*100)/100;
                        var seller_value = Math.round((amount-not_delivered_penalty)*100)/100;
                    }else{
                        var amount = (price+not_delivered_penalty)*(j-i)/result.max_evaluation/result.quotient;
                        var buyer_value = Math.round((-(price+not_delivered_penalty)*j/result.max_evaluation-amount+not_delivered_penalty)*100)/100;
                        var seller_value = Math.round(((price+not_delivered_penalty)*i/result.max_evaluation-amount-not_delivered_penalty)*100)/100;
                    }
                    html_str += "<td>"+buyer_value+" \\ "+seller_value+"</td>";
                }
                html_str += "</tr>";

            }
            $('#mytable').html(html_str);
        })
    },
    upfront: function(){
        App.contract.deployed().then(function(instance){
            return instance.upfront(App.owner,App.index,
                {
                    from: App.account,
                    value: App.web3.utils.toWei(String(App.upfront_value),"finney"),
                    gas: 500000
                }
            );
        });
    },
    evaluate: function(){
        App.contract.deployed().then(function(instance){
            if($('.eval_upfront').is(":checked")){
                var pay_upfront = true;
                var upfront = App.web3.utils.toWei(String(App.upfront_value),"finney");
            }else{
                var pay_upfront = false;
                var upfront = 0;
            }
            return instance.evaluate($('#evaluation').val(),pay_upfront,App.owner,App.index,
                {
                    from: App.account,
                    value: upfront,
                    gas: 500000
                }
            );
        });
    },
    withdraw: function(){
        App.contract.deployed().then(function(instance){
            return instance.withdraw(App.owner,App.index,
                {
                    from: App.account,
                    value: 0,
                    gas: 500000
                }
            );
        });
    }
}

$(function(){
    $(window).load(function(){
        App.init();
    })
});

$(".thirdParty").change(function () {
    //check if its checked. If checked move inside and check for others value
    if (this.checked && this.value === "other") {
        //add a text box next to it
        $(this).next("label").after("<input class='form-control thirdParty' name='thirdParty' id='other-text' placeholder='Address' type='text'/>")
    } else {
        //remove if unchecked
        $("#other-text").remove();
    }
});

$("#evaluation-input").hide();

$(".evaluation").change(function () {
    //check if its checked. If checked move inside and check for others value
    if (this.checked && this.value === "true") {
        //add a text box next to it
        $("#evaluation-input").show();

        var max_evaluation = parseFloat($('#max_evaluation').val());
        var quotient = parseFloat($('#quotient').val());
        var price = parseFloat($('#price').val());
        var not_delivered_penalty = parseFloat($('#not_delivered_penalty').val());

        var html_str = "<table id='table-preview' class='table table-bordered w-75' style='text-align: center;'>"
        html_str += "<tr><th style='width: "+100/(max_evaluation+2)+"%' scope='col'>Buyer \\ Seller</th>";
        for(var j = 0; j <= max_evaluation;j++){
            html_str += "<th style='width: "+100/(max_evaluation+2)+"%' scope='col'>"+j+"</th>";
        }
        html_str += '</tr>';      
            
        for(var i = 0;i <= max_evaluation;i++){

            html_str += "<tr><th scope='row'>"+i+"</th>";
            for(var j = 0; j <= max_evaluation;j++){
                
                if(i >= j){
                    var amount = (price+not_delivered_penalty)*(i+j)/max_evaluation/2;
                    var buyer_value = Math.round((-amount+not_delivered_penalty)*100)/100;
                    var seller_value = Math.round((amount-not_delivered_penalty)*100)/100;
                }else{
                    var amount = (price+not_delivered_penalty)*(j-i)/max_evaluation/quotient;
                    var buyer_value = Math.round((-(price+not_delivered_penalty)*j/max_evaluation-amount+not_delivered_penalty)*100)/100;
                    var seller_value = Math.round(((price+not_delivered_penalty)*i/max_evaluation-amount-not_delivered_penalty)*100)/100;
                }
                html_str += "<td>"+buyer_value+" \\ "+seller_value+"</td>";
            }
            html_str += "</tr>";
        }
        html_str += "</table>"

        $('#table-preview-div').html(html_str);
    } else {
        //remove if unchecked
        $("#evaluation-input").hide();
        $("#table-preview").hide();
    }
});

